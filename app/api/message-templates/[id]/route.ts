import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { recordAuditAction } from '@/lib/audit';

const VALID_CHANNELS = ['whatsapp', 'telegram', 'email', 'sms'];
const VALID_STAGES = ['preventiva', 'amigavel', 'negocial', 'especializada', 'generic'];
const SUPPORTED_VARIABLES = ['nome', 'valor', 'vencimento', 'dias_atraso', 'empresa', 'dias_para_negativacao'];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const tenant = await requireRole(req, 'admin', new URL(req.url).searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const { data: current, error: currentError } = await ctx.supabase
      .from('message_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (currentError) return serverError('message-templates PUT lookup error', currentError);
    if (!current) return NextResponse.json({ error: 'Template não encontrado ou acesso negado.' }, { status: 404 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'name é obrigatório.' }, { status: 400 });
      }
      update.name = body.name.trim();
    }
    if (body.stage !== undefined) {
      if (!VALID_STAGES.includes(body.stage)) return NextResponse.json({ error: 'Estágio inválido.' }, { status: 400 });
      update.stage = body.stage;
    }
    if (body.channel !== undefined) {
      if (!VALID_CHANNELS.includes(body.channel)) return NextResponse.json({ error: 'Canal inválido.' }, { status: 400 });
      update.channel = body.channel;
    }
    if (body.body !== undefined) {
      if (typeof body.body !== 'string' || !body.body.trim()) {
        return NextResponse.json({ error: 'body é obrigatório.' }, { status: 400 });
      }
      const variables: string[] = Array.from(new Set((body.body.match(/\{(\w+)\}/g) || []).map((v: string) => v.slice(1, -1))));
      const unsupported = variables.filter((v: string) => !SUPPORTED_VARIABLES.includes(v));
      if (unsupported.length > 0) {
        return NextResponse.json({ error: `Variáveis não suportadas: ${unsupported.join(', ')}.` }, { status: 400 });
      }
      update.body = body.body.trim();
      update.variables = variables;
    }
    if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);
    if (body.language !== undefined) update.language = body.language;

    const { data: updated, error } = await ctx.supabase
      .from('message_templates')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .select()
      .single();
    if (error) return serverError('message-templates PUT update error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'message_template',
      entityId: id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'MESSAGE_TEMPLATE_UPDATED',
      before: current,
      after: updated,
    });

    return NextResponse.json({ ok: true, template: updated });
  } catch (error) {
    return serverError('message-templates PUT exception', error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireRole(req, 'admin', new URL(req.url).searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const { data: current, error: currentError } = await ctx.supabase
      .from('message_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();
    if (currentError) return serverError('message-templates DELETE lookup error', currentError);
    if (!current) return NextResponse.json({ error: 'Template não encontrado ou acesso negado.' }, { status: 404 });

    const { error } = await ctx.supabase
      .from('message_templates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId);
    if (error) return serverError('message-templates DELETE error', error);

    await recordAuditAction(ctx.supabase, {
      tenantId: ctx.tenantId,
      entityType: 'message_template',
      entityId: id,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: 'MESSAGE_TEMPLATE_DELETED',
      before: current,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('message-templates DELETE exception', error);
  }
}