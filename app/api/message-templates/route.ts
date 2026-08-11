import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';

const VALID_CHANNELS = ['whatsapp', 'telegram', 'email', 'sms'];
const VALID_STAGES = ['preventiva', 'amigavel', 'negocial', 'especializada', 'generic'];
const SUPPORTED_VARIABLES = ['nome', 'valor', 'vencimento', 'dias_atraso', 'empresa', 'dias_para_negativacao'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = await requireRole(req, 'member', searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
    const stage = (searchParams.get('stage') || '').trim();
    const onlyActive = searchParams.get('active') === 'true';
    const offset = (page - 1) * limit;

    let query = ctx.supabase
      .from('message_templates')
      .select('*', { count: 'exact' })
      .eq('tenant_id', ctx.tenantId);

    if (stage && stage !== 'all') query = query.eq('stage', stage);
    if (onlyActive) query = query.eq('is_active', true);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return serverError('message-templates GET error', error);

    return NextResponse.json({
      templates: data || [],
      totalPages: Math.ceil((count || 0) / limit) || 1,
      total: count || 0,
    });
  } catch (error) {
    return serverError('message-templates GET exception', error);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const requestedTenantId = (typeof body?.tenant_id === 'string' ? body.tenant_id : null)
    || new URL(req.url).searchParams.get('tenant_id');
  const tenant = await requireRole(req, 'admin', requestedTenantId);
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const stage = typeof body.stage === 'string' ? body.stage : '';
    const templateBody = typeof body.body === 'string' ? body.body.trim() : '';
    const channel = typeof body.channel === 'string' ? body.channel : 'whatsapp';

    if (!name || !templateBody) {
      return NextResponse.json({ error: 'name e body são obrigatórios.' }, { status: 400 });
    }
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Estágio inválido.' }, { status: 400 });
    }
    if (!VALID_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: 'Canal inválido.' }, { status: 400 });
    }

    // Detecta variáveis usadas e valida contra as suportadas
    const variables: string[] = Array.from(new Set((templateBody.match(/\{(\w+)\}/g) || []).map((v: string) => v.slice(1, -1))));
    const unsupported = variables.filter((v: string) => !SUPPORTED_VARIABLES.includes(v));
    if (unsupported.length > 0) {
      return NextResponse.json({ error: `Variáveis não suportadas: ${unsupported.join(', ')}.` }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from('message_templates')
      .insert({
        tenant_id: ctx.tenantId,
        name,
        channel,
        stage,
        language: body.language || 'pt-BR',
        body: templateBody,
        variables,
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (error) return serverError('message-templates POST insert error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'message_template',
      entityId: data.id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'MESSAGE_TEMPLATE_CREATED',
      after: data,
    });

    return NextResponse.json({ ok: true, template: data }, { status: 201 });
  } catch (error) {
    return serverError('message-templates POST exception', error);
  }
}