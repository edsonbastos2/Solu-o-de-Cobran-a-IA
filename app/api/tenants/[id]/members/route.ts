import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireTenantContext, serverError } from '@/lib/api-auth';

// GET /api/tenants/[id]/members — lista membros (ativos + pendentes).
//
// Autorização: requireTenantContext (qualquer membro ativo, sem elevação de
// papel — ver docs/1805-gestao-usuarios-tenant/adrs/adr-002.md).
//
// Dados: usa o client admin (service role) em vez do client normal descrito
// no ADR-002, porque a política RLS profile_select (supabase_tenant_model.sql)
// restringe a leitura de public.profiles à própria linha do usuário — um
// membro comum não consegue ler nome/e-mail de colegas de tenant via RLS. O
// client admin é necessário aqui apenas para resolver esses campos; a
// autorização de QUEM pode chamar a rota continua inteiramente na camada de
// aplicação (requireTenantContext), e toda consulta filtra explicitamente
// .eq('tenant_id', tenantId) conforme a convenção de client admin do
// CLAUDE.md.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const search = new URL(req.url).searchParams;
    const requestedTenantId = search.get('tenant_id') ?? id;

    const tctx = await requireTenantContext(req, requestedTenantId);
    if ('response' in tctx) return tctx.response;
    const { tenantId } = tctx.ctx;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin não configurado.' }, { status: 500 });
    }

    const { data: members, error: membersError } = await admin
      .from('tenant_members')
      .select('id, user_id, role, status, can_configure_ai, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (membersError) {
      return serverError('tenants/[id]/members GET members error', membersError);
    }

    const userIds = (members ?? []).map((m) => m.user_id);
    let profilesById = new Map<string, { name: string | null; email: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id, name, email')
        .eq('tenant_id', tenantId)
        .in('id', userIds);

      if (profilesError) {
        return serverError('tenants/[id]/members GET profiles error', profilesError);
      }

      profilesById = new Map((profiles ?? []).map((p) => [p.id as string, { name: p.name, email: p.email }]));
    }

    const result = (members ?? []).map((m) => {
      const profile = profilesById.get(m.user_id);
      return {
        id: m.id,
        userId: m.user_id,
        email: profile?.email ?? null,
        name: profile?.name ?? null,
        role: m.role,
        canConfigureAI: m.can_configure_ai === true,
        status: m.status,
        createdAt: m.created_at,
      };
    });

    return NextResponse.json({ members: result });
  } catch (err) {
    return serverError('tenants/[id]/members GET exception', err);
  }
}
