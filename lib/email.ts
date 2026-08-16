// Envio de e-mail transacional via SMTP (Nodemailer, ver docs/1805-*).
// Credenciais globais via env var (SMTP_HOST/PORT/USER/PASS/EMAIL_FROM) — não
// por tenant, já que o envio de convite é uma ação do sistema, não do tenant.
import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '@/lib/logger';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;

  if (!cachedTransporter) {
    const numericPort = Number(port);
    cachedTransporter = nodemailer.createTransport({
      host,
      port: numericPort,
      secure: numericPort === 465,
      auth: { user, pass },
    });
  }
  return cachedTransporter;
}

/** Envia um e-mail; nunca lança — falha de configuração/entrega vira { success: false }. */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<SendEmailResult> {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM;

  if (!transporter || !from) {
    logger.warn('lib/email: SMTP_* ou EMAIL_FROM ausente, e-mail não enviado', undefined, { to, subject });
    return { success: false, error: 'Serviço de e-mail não configurado.' };
  }

  try {
    await transporter.sendMail({ from, to, subject, html });
    return { success: true };
  } catch (err) {
    logger.error('lib/email: falha ao enviar e-mail via SMTP', undefined, {
      to,
      subject,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: 'Falha ao enviar e-mail.' };
  }
}
