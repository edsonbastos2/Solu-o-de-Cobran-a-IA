// Rate limiter com suporte a múltiplas instâncias.
//
// Quando UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN estão configurados,
// usa a REST API do Upstash Redis (janela fixa via INCR + EXPIRE atomicamente
// agendados). Caso contrário, cai no rate limiter in-memory (janela fixa),
// adequado para modo demo / instância única.
//
// Assinatura estável: rateLimit(key, max, windowMs) → Promise<boolean>.
// true = requisição ACEITA dentro do limite; false = excedeu o limite.

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

/** Fallback in-memory — janela fixa por chave. */
function memoryLimit(key: string, max: number, windowMs: number): boolean {
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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Retorna true se a requisição foi ACEITA (dentro do limite),
 * false se excedeu.
 *
 * Usa Upstash Redis quando configurado; caso contrário cai para o
 * fallback in-memory (modo demo / instância única).
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const fullKey = `rl:${key}`;
      const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      // Pipeline atomático: INCR seguido de EXPIRE apenas na primeira vez.
      const res = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', fullKey],
          ['EXPIRE', fullKey, ttlSeconds],
        ]),
        signal: AbortSignal.timeout(1000),
      });

      if (res.ok) {
        const json: unknown = await res.json();
        const results = Array.isArray(json) ? json : json != null && typeof json === 'object' && Array.isArray((json as { result?: unknown }).result)
          ? (json as { result: unknown[] }).result
          : [];
        const count = Number(results[0]);
        if (Number.isFinite(count)) {
          return count <= max;
        }
      }
      // Se a resposta não for utilizável, cai no fallback in-memory.
    } catch {
      // Falha de rede / timeout → fallback in-memory (não bloqueia o fluxo).
    }
  }

  return memoryLimit(key, max, windowMs);
}