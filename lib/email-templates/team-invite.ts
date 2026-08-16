// Template do e-mail de convite de equipe (ticket 1805). HTML inline-styled,
// sem CSS/JS externo — clientes de e-mail não confiam em <style> externo.
import { ROLE_LABELS, type TenantRole } from '@/lib/team-roles-client';

export interface TeamInviteEmailParams {
  tenantName: string;
  inviterName: string;
  role: TenantRole;
  acceptUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildTeamInviteEmail({
  tenantName,
  inviterName,
  role,
  acceptUrl,
}: TeamInviteEmailParams): { subject: string; html: string } {
  const roleLabel = ROLE_LABELS[role];
  const safeTenantName = escapeHtml(tenantName);
  const safeInviterName = escapeHtml(inviterName);
  const safeRoleLabel = escapeHtml(roleLabel);
  const safeAcceptUrl = escapeHtml(acceptUrl);

  const subject = `${inviterName} convidou você para o time da ${tenantName} no CobrançaIA`;

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#0c0d10;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0d10;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#111318;border-radius:16px;padding:32px;">
            <tr>
              <td style="color:#ffffff;font-size:20px;font-weight:bold;padding-bottom:16px;">CobrançaIA</td>
            </tr>
            <tr>
              <td style="color:#e2e8f0;font-size:15px;line-height:1.6;padding-bottom:24px;">
                <strong>${safeInviterName}</strong> convidou você para fazer parte do time de
                <strong>${safeTenantName}</strong> como <strong>${safeRoleLabel}</strong>.
                Clique no botão abaixo para criar sua senha e acessar a plataforma.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${safeAcceptUrl}" style="background-color:#10b981;color:#000000;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;display:inline-block;">
                  Aceitar convite e criar senha
                </a>
              </td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:12px;line-height:1.5;">
                Se você não esperava este convite, pode ignorar este e-mail com segurança.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
