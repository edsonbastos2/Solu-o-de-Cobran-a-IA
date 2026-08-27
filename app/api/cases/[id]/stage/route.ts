import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { validateFields } from '@/lib/api-validate';
import { rateLimit } from '@/lib/rate-limit';
import { moveCaseStage } from '@/lib/crm/stage-service';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
  }

  const invalid = validateFields(body, [{ name: 'stageId', type: 'string' }]);
  if (invalid) return invalid;

  const tenant = await requireTenantContext(
    req,
    searchParams.get('tenant_id') ?? (body.tenant_id as string | null) ?? null
  );
  if ('response' in tenant) return tenant.response;

  if (!(await rateLimit(`cases:stage:${tenant.ctx.userId}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  try {
    const { ctx } = tenant;
    const result = await moveCaseStage(ctx.supabase, ctx, id, {
      stageId: body.stageId as string,
      expectedStageId: typeof body.expectedStageId === 'string' ? body.expectedStageId : undefined,
      reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : undefined,
    });
    if (!result.ok) {
      const status = RESULT_STATUS[result.error_code] ?? 500;
      const payload: Record<string, unknown> = { error: result.message, code: result.error_code };
      if (result.error_code === 'STAGE_CONFLICT') payload.currentStage = result.currentStage ?? null;
      return NextResponse.json(payload, { status });
    }
    return NextResponse.json({ case: result.case });
  } catch (error) {
    return serverError('case stage move exception', error);
  }
}

const RESULT_STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  STAGE_CONFLICT: 409,
  INVALID_TRANSITION: 422,
};
