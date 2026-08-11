import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverError } from '@/lib/api-auth';
import { resolveTemplateVariables } from '@/lib/message-templates';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Preview server-side com caso real do tenant.
// Substituição de variáveis SEMPRE no servidor.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const tenant = await requireRole(req, 'member', new URL(req.url).searchParams.get('tenant_id'));
  if ('response' in tenant) return tenant.response;

  try {
    const { ctx } = tenant;
    const caseId = typeof body?.case_id === 'string' ? body.case_id : '';
    const companyName = typeof body?.company_name === 'string' ? body.company_name : undefined;

    if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(caseId)) {
      return NextResponse.json({ error: 'template_id e case_id são obrigatórios.' }, { status: 400 });
    }

    const { data: template, error } = await ctx.supabase
      .from('message_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) return serverError('message-templates preview lookup error', error);
    if (!template) return NextResponse.json({ error: 'Template não encontrado ou inativo.' }, { status: 404 });

    const { body: resolved, used } = await resolveTemplateVariables(
      { supabase: ctx.supabase, tenantId: ctx.tenantId, caseId, companyName },
      template.body
    );

    return NextResponse.json({ ok: true, body: resolved, used, template });
  } catch (error) {
    return serverError('message-templates preview exception', error);
  }
}