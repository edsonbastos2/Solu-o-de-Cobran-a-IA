import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser, serverError } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSupabaseServer } from '@/lib/supabase-server';
import { resolveAIConfig } from '@/lib/ai-config';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

const EXTRACTION_PROMPT = `You are an expert lawyer and data extraction assistant. Extract the following information from the contract provided. If a field is not found, leave it empty or null.

Return a JSON with the following fields:
{
  "client_name": "Nome completo do cliente",
  "client_document": "CPF ou CNPJ do cliente",
  "client_address": "Endereço completo do cliente",
  "client_phone": "Telefone de contato",
  "client_email": "Email do cliente",
  "contract_number": "Número do contrato",
  "type": "Tipo do contrato",
  "start_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "total_value": 0.00,
  "installments_count": 0,
  "interest_rate": 0.00,
  "penalty_rate": 0.00,
  "monetary_correction_index": "Ex: IPCA, IGPM, etc",
  "guarantees": "Garantias previstas",
  "guarantors": "Fiadores/avalistas",
  "negative_allowed": false,
  "protest_allowed": false,
  "forum": "Foro do contrato"
}`;

export async function POST(req: NextRequest) {
  // Autenticação obrigatória — antes este endpoint era public, permitindo que
  // qualquer anônimo consumisse a OPENCODE_API_KEY do servidor (custo ilimitado).
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const { userId, currentTenantId } = auth.ctx;

  // Rate limit por usuário: 10 extrações/minuto — protege contra abuso da chave.
  const allowed = await rateLimit(`extract-contract:${userId}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Limite de extrações por minuto excedido. Tente novamente em instantes.' },
      { status: 429 }
    );
  }

  try {
    // Resolução centralizada de IA (ADR-003): bucket pdf_extraction do tenant.
    // extração de contrato pode ocorrer antes da seleção de tenant (onboarding
    // super-admin); quando não houver tenant ativo, degrada para o default de
    // sistema → fallback hardcoded (opencode/minimax-m3/OPENCODE_API_KEY).
    const admin = getSupabaseAdmin();
    const serverClient = getSupabaseServer(req);
    let tenantId = currentTenantId;
    if (!tenantId && (admin || serverClient)) {
      const membershipClient = admin ?? serverClient!;
      const { data: membership } = await membershipClient
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      tenantId = (membership as { tenant_id?: string | null } | null)?.tenant_id ?? null;
    }
    const ai = await resolveAIConfig({
      client: admin ?? serverClient,
      tenantId: tenantId ?? '',
      bucket: 'pdf_extraction',
    });
    const apiKey = ai.apiKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave de API não configurada para extração de PDF. Configure o bucket 'Extração de PDF' do tenant ou o padrão de sistema." },
        { status: 500 }
      );
    }

    const baseURL = ai.provider === 'anthropic' ? ANTHROPIC_BASE_URL : OPENCODE_BASE_URL;

    const formData = await req.formData();
    const contractText = formData.get("contractText") as string;
    const file = formData.get("file") as File | null;

    if (!contractText && !file) {
      return NextResponse.json({ error: "contractText or file is required" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey, baseURL });

    const userText = contractText || "Extraia os dados deste contrato.";
    const content: Anthropic.Messages.ContentBlockParam[] = [];

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type || 'application/pdf';
      const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        content.push({
          type: 'document',
          title: file.name,
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        });
      } else if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        });
      } else {
        return NextResponse.json(
          { error: "Formato de arquivo não suportado. Envie um PDF ou uma imagem JPEG, PNG, GIF ou WEBP." },
          { status: 400 }
        );
      }
    }

    content.push({ type: 'text', text: userText });

    const response = await anthropic.messages.create({
      model: ai.model,
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content }],
      max_tokens: 4096,
      temperature: 0,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const resultText = textBlock?.type === 'text' ? textBlock.text : '{}';

    let result: any;
    try {
      result = JSON.parse(resultText);
    } catch {
      const match = resultText.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : {};
    }

    // Auditoria do uso da chave de IA (prevenção de abuso e rastreabilidade).
    try {
      if (admin) {
        // tenant_id opcional — extração de contrato pode ocorrer antes da
        // seleção do tenant (super-admin onboarding). Auditoria global do ator.
        await recordAuditAction(admin, {
          tenantId: currentTenantId ?? '',
          entityType: 'contract_extraction',
          entityId: result?.contract_number || 'unknown',
          actorUserId: userId,
          action: 'CONTRACT_EXTRACTED',
          metadata: {
            file_name: file?.name || null,
            file_size: file?.size || null,
            has_text: !!contractText,
            model: ai.model,
            provider: ai.provider,
            source: ai.source,
          },
        }).catch(() => { /* auditoria não bloqueia extração */ });
      }
    } catch { /* no-op */ }

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Extraction error', undefined, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
