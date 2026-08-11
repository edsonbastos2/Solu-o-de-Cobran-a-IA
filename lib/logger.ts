// Logging estruturado com níveis e contexto (tenant/user/request).
//
// - Quando SENTRY_DSN está configurado, envia erros para o Sentry (via API
//   HTTP direta, sem dependência do SDK).
// - Caso contrário, emite JSON estruturado no console (stdout/stderr).
// - Nunca registrar dados sensíveis: chaves de IA, tokens, senhas, etc.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  tenantId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  [key: string]: unknown;
}

type Meta = Record<string, unknown> | undefined;

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const redactKeys = new Set([
  'api_key',
  'apikey',
  'token',
  'secret',
  'password',
  'authorization',
  'service_role_key',
  'zapi_token',
  'zapi_client_token',
  'telegram_bot_token',
]);

function sanitizeValue(key: string, value: unknown): unknown {
  if (MIN_REDACTED.test(key)) return '[REDACTED]';
  return value;
}

const MIN_REDACTED =
  /(api.?key|apikey|secret|token|password|authorization|service_role|zapi|_dsn|_url|_token)/i;

function sanitize(input: Meta): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = MIN_REDACTED.test(String(key)) ? '[REDACTED]' : value;
  }
  return out;
}

function shouldLog(level: LogLevel): boolean {
  const configured = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  const threshold = LEVEL_WEIGHT[configured] ?? LEVEL_WEIGHT.info;
  return LEVEL_WEIGHT[level] >= threshold;
}

function emit(level: LogLevel, message: string, context?: LogContext, meta?: Meta) {
  if (!shouldLog(level)) return;
  const entry = {
    level,
    ts: new Date().toISOString(),
    message,
    context: context || {},
    meta: sanitize(meta),
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug(message: string, context?: LogContext, meta?: Meta) {
    emit('debug', message, context, meta);
  },
  info(message: string, context?: LogContext, meta?: Meta) {
    emit('info', message, context, meta);
  },
  warn(message: string, context?: LogContext, meta?: Meta) {
    emit('warn', message, context, meta);
  },
  error(message: string, context?: LogContext, meta?: Meta) {
    emit('error', message, context, meta);
  },
};

// SENTRY_DSN health-check helper (sem SDK): captura erros para Sentry se configurado.
const SENTRY_DSN = process.env.SENTRY_DSN;

/**
 * Envia um erro para o Sentry se SENTRY_DSN estiver configurado.
 * Em modo demo (sem DSN), apenas loga o erro estruturado.
 */
export async function captureError(
  message: string,
  err?: unknown,
  context?: LogContext,
  meta?: Meta
): Promise<void> {
  logger.error(message, context, { ...(meta || {}), error: err instanceof Error ? err.message : err });
  if (!SENTRY_DSN) return;
  try {
    const url = new URL('/api/1/errors/', SENTRY_DSN);
    const payload = {
      timestamp: new Date().toISOString(),
      logger: message,
      context: { ...(context || {}), ...sanitize(meta || {}) },
    };
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) logger.warn('Sentry delivery falhou', undefined, { status: res.status });
  } catch (sendErr) {
    logger.warn('Sentry delivery exception', undefined, {
      error: sendErr instanceof Error ? sendErr.message : String(sendErr),
    });
  }
}