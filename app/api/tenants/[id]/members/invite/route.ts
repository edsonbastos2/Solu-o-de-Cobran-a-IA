import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireRole, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';
import { recordAuditAction } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import {
  buildConfirmUrl,
  isDuplicateInviteError,
  isInvitableRole,
  resolveInviteEmailContext,
} from '@/lib/team-invite';
import { sendEmail } from '@/lib/email';
import { buildTeamInviteEmail } from '@/lib/email-templates/team-invite';
import { logger } from '@/lib/logger';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/tenants/[id]/members/invite — convida um novo membro por e-mail.
// requireRole('admin') — owner e admin podem convidar; ver ADR-002/ADR-003.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const r = await requireRole(req, 'admin', id);
    if ('response' in r) return r.response;
    const { ctx } = r;
    const tenantId = ctx.tenantId;

    const allowed = await rateLimit(`team-invite:${tenantId}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Muitos convites em pouco tempo. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const validationError = validateFields(body, [
      { name: 'email', type: 'string' },
      { name: 'role', type: 'string' },
    ]);
    if (validationError) return validationError;

    const email = String(body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    }

    if (body.role === 'owner') {
      return NextResponse.json(
        { error: 'Não é possível convidar um segundo owner para o tenant.' },
        { status: 400 }
      );
    }
    if (!isInvitableRole(body.role)) {
      return NextResponse.json(
        { error: 'Papel inválido. Use admin, gestor ou operador.' },
        { status: 400 }
      );
    }
    const role = body.role;

    if (body.canConfigureAI !== undefined && typeof body.canConfigureAI !== 'boolean') {
      return NextResponse.json({ error: 'canConfigureAI deve ser booleano.' }, { status: 400 });
    }
    const canConfigureAI = body.canConfigureAI === true;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: {
          invited_tenant_id: tenantId,
          invited_role: role,
          invited_can_configure_ai: canConfigureAI,
        },
      },
    });

    if (linkError) {
      if (isDuplicateInviteError(linkError)) {
        return NextResponse.json(
          { error: 'Este e-mail já está registrado no sistema. Não é possível reatribuí-lo automaticamente.' },
          { status: 409 }
        );
      }
      return serverError('tenants/[id]/members/invite error', linkError);
    }

    const invitedUserId = linkData.user?.id;
    const hashedToken = linkData.properties?.hashed_token;
    if (!invitedUserId || !hashedToken) {
      return serverError('tenants/[id]/members/invite: resposta sem link', linkError);
    }
    const acceptUrl = buildConfirmUrl(hashedToken, 'invite');

    const { tenantName, inviterName } = await resolveInviteEmailContext(admin, tenantId, ctx.userId);
    const { subject, html } = buildTeamInviteEmail({ tenantName, inviterName, role, acceptUrl });
    const emailResult = await sendEmail({ to: email, subject, html });
    if (!emailResult.success) {
      logger.warn(
        'tenants/[id]/members/invite: falha ao enviar e-mail de convite',
        { tenantId },
        { error: emailResult.error }
      );
      return NextResponse.json(
        {
          error:
            'Convite criado, mas não foi possível enviar o e-mail. Verifique a configuração de e-mail e use "reenviar convite".',
        },
        { status: 502 }
      );
    }

    await recordAuditAction(admin, {
      tenantId,
      entityType: 'tenant_member',
      entityId: invitedUserId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'TEAM_MEMBER_INVITED',
      metadata: { email, role, canConfigureAI },
    });

    return NextResponse.json(
      { success: true, userId: invitedUserId, email, role, canConfigureAI, status: 'pending' },
      { status: 201 }
    );
  } catch (err) {
    return serverError('tenants/[id]/members/invite exception', err);
  }
}
