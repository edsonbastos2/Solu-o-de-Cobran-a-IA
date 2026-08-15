import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { isDuplicateInviteError, isEmailDeliveryError } from '@/lib/team-invite';
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

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_tenant_id: tenantId,
        invited_role: target.role,
        invited_can_configure_ai: target.can_configure_ai === true,
      },
    });

    if (inviteError) {
      if (isEmailDeliveryError(inviteError)) {
        logger.warn(
          'tenants/[id]/members/[memberId]/resend: entrega de e-mail indisponível',
          { tenantId },
          { error: inviteError.message, code: inviteError.code }
        );
        return NextResponse.json(
          {
            error:
              'Não foi possível reenviar o e-mail de convite. Verifique se o SMTP está configurado no projeto Supabase.',
          },
          { status: 502 }
        );
      }
      if (isDuplicateInviteError(inviteError)) {
        return serverError('tenants/[id]/members/[memberId]/resend: duplicidade inesperada', inviteError);
      }
      return serverError('tenants/[id]/members/[memberId]/resend error', inviteError);
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
