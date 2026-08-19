import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';

const LINK_TTL_MS = 48 * 60 * 60 * 1000;
const GENERATION_RATE_LIMIT_MAX = 10;
const GENERATION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const tenant = await requireRole(req, 'gestor', searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;

    const body = await req.json().catch(() => null);
    if (body?.channel !== 'telegram') {
      return NextResponse.json(
        { error: 'Canal inválido. Apenas o canal telegram é suportado.' },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await ctx.supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (clientError) return serverError('channel-links client lookup error', clientError);
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado ou acesso negado.' }, { status: 404 });
    }

    const { data: config, error: configError } = await ctx.supabase
      .from('channel_configs')
      .select('enabled, bot_username')
      .eq('tenant_id', ctx.tenantId)
      .eq('channel', 'telegram')
      .maybeSingle();
    if (configError) return serverError('channel-links config lookup error', configError);
    if (!config || !config.enabled || !config.bot_username) {
      return NextResponse.json(
        { error: 'Configure o canal Telegram antes de gerar links.' },
        { status: 400 }
      );
    }

    // Rate limit de geração por cliente (anti-enumeração de tokens).
    if (
      !(await rateLimit(
        `channel-links:${ctx.tenantId}:${id}`,
        GENERATION_RATE_LIMIT_MAX,
        GENERATION_RATE_LIMIT_WINDOW_MS
      ))
    ) {
      return NextResponse.json(
        { error: 'Limite de geração de links atingido para este cliente. Tente novamente em uma hora.' },
        { status: 429 }
      );
    }

    // Token opaco de 128 bits; apenas o SHA-256 é persistido (ADR-002).
    const token = randomBytes(16).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();

    const { error: insertError } = await ctx.supabase.from('channel_link_tokens').insert({
      tenant_id: ctx.tenantId,
      client_id: id,
      channel: 'telegram',
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insertError) return serverError('channel-links insert error', insertError);

    // Auditoria sem dados sensíveis (o token opaco nunca é registrado).
    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'client',
      entityId: id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'CHANNEL_LINK_TOKEN_CREATED',
      metadata: { channel: 'telegram' },
    });

    return NextResponse.json({
      link: `https://t.me/${config.bot_username}?start=${token}`,
      expires_at: expiresAt,
    });
  } catch (error) {
    return serverError('channel-links POST exception', error);
  }
}
