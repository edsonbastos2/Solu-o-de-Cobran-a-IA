import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireRole, serverError, TenantRole } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { buildConfirmUrl, isDuplicateInviteError, resolveInviteEmailContext } from '@/lib/team-invite';
import { sendEmail } from '@/lib/email';
import { buildTeamInviteEmail } from '@/lib/email-templates/team-invite';
import { logger } from '@/lib/logger';

// POST /api/tenants/[id]/members/[memberId]/resend — reenvia um convite
// pendente. requireRole('admin'). Só aceita alvos com status='pending'.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await context.params;
    const r = await requireRole(req, 'admin', id);
    if ('response' in r) return r.response;
    const { ctx } = r;
    const tenantId = ctx.tenantId;

    const allowed = await rateLimit(`team-resend:${tenantId}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Muitos reenvios em pouco tempo. Tente novamente em instantes.' },
        { status: 429 }
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { data: target, error: targetError } = await admin
      .from('tenant_members')
      .select('id, user_id, role, status, can_configure_ai')
      .eq('id', memberId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (targetError) return serverError('tenants/[id]/members/[memberId]/resend lookup error', targetError);
    if (!target) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    }
    if (target.status !== 'pending') {
      return NextResponse.json(
        { error: 'Este convite já foi aceito; não há nada para reenviar.' },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(target.user_id);
    if (userError || !userData?.user?.email) {
      return serverError('tenants/[id]/members/[memberId]/resend: usuário convidado não encontrado', userError);
    }
    const email = userData.user.email;
    const role = target.role as TenantRole;

    // O usuário já existe (não confirmado) desde o convite original, então
    // generateLink({type:'invite'}) rejeita por "já registrado" — nesse caso
    // caímos para type:'recovery', que gera um link válido para o mesmo
    // usuário pendente e, ao ser verificado, também confirma o e-mail
    // (dispara handle_invited_user_confirmed() igual ao link de convite).
    let linkType: 'invite' | 'recovery' = 'invite';
    let linkResult = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: {
          invited_tenant_id: tenantId,
          invited_role: role,
          invited_can_configure_ai: target.can_configure_ai === true,
        },
      },
    });

    if (linkResult.error && isDuplicateInviteError(linkResult.error)) {
      linkType = 'recovery';
      linkResult = await admin.auth.admin.generateLink({ type: 'recovery', email });
    }

    if (linkResult.error) {
      return serverError('tenants/[id]/members/[memberId]/resend error', linkResult.error);
    }

    const hashedToken = linkResult.data.properties?.hashed_token;
    if (!hashedToken) {
      return serverError('tenants/[id]/members/[memberId]/resend: resposta sem link', linkResult.error);
    }
    const acceptUrl = buildConfirmUrl(hashedToken, linkType);

    const { tenantName, inviterName } = await resolveInviteEmailContext(admin, tenantId, ctx.userId);
    const { subject, html } = buildTeamInviteEmail({ tenantName, inviterName, role, acceptUrl });
    const emailResult = await sendEmail({ to: email, subject, html });
    if (!emailResult.success) {
      logger.warn(
        'tenants/[id]/members/[memberId]/resend: falha ao enviar e-mail de convite',
        { tenantId },
        { error: emailResult.error }
      );
      return NextResponse.json(
        {
          error:
            'Não foi possível reenviar o e-mail de convite. Verifique a configuração de e-mail (RESEND_API_KEY/EMAIL_FROM).',
        },
        { status: 502 }
      );
    }

    await recordAuditAction(admin, {
      tenantId,
      entityType: 'tenant_member',
      entityId: memberId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'TEAM_MEMBER_INVITE_RESENT',
      metadata: { email, userId: target.user_id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('tenants/[id]/members/[memberId]/resend exception', err);
  }
}
