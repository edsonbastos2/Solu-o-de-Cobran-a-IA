// Rate limiter simples in-memory (janela fixa por chave).
// Adequado para instâncias únicas. Para multi-inância, considere Upstash Redis.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Limpa buckets expirados a cada chamada (lazy).
function cleanup(now: number) {
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/**
 * Retorna true se a requisição foi ACEITA (dentro do limite),
 * false se excedeu.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  cleanup(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}