import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/api-auth';
import { generateCaseInsights } from '@/lib/case-insights';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { expiresAt: number; data: unknown }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenant = await requireTenantContext(req, searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;
  const { ctx } = tenant;

  const cacheKey = `${ctx.tenantId}:${id}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json(hit.data);
  }
  if (hit) cache.delete(cacheKey);

  const result = await generateCaseInsights(ctx.supabase, id, ctx.tenantId);
  if ('error' in result) {
    const isConfig = typeof result.error === 'string' && result.error.includes('Chave de API');
    const isNotFound = result.error === 'Caso não encontrado';
    return NextResponse.json({ error: result.error }, { status: isNotFound ? 404 : isConfig ? 502 : 500 });
  }
  cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data: result });
  return NextResponse.json(result);
}