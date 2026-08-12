import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { recordAuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveAIConfig } from '@/lib/ai-config';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

const EXTRACTION_PROMPT = `Analise este documento (PDF ou Imagem) e extraia todas as informações de devedores / clientes com débitos.
Retorne uma lista JSON com os devedores encontrados.
Para cada devedor, extraia os seguintes campos se disponíveis:
- name: Nome completo ou Razão Social
- phone: Número de telefone/WhatsApp com DDD (somente dígitos com DDD ou formatado)
- email: E-mail do devedor
- document: CPF ou CNPJ
- address: Endereço completo (Rua, Número, Bairro, Cidade, Estado, CEP)
- notes: Informações adicionais relevantes, como número do contrato, título ou detalhes da dívida

Se um campo não for identificado, use string vazia "".
Mantenha a lista o mais precisa e completa possível.

Retorne um JSON no formato: { "debtors": [ { "name": "", "phone": "", "email": "", "document": "", "address": "", "notes": "" } ] }`;

export async function POST(req: NextRequest) {
  // Hardening (ADR-005): antes este endpoint era público e consumia
  // OPENCODE_API_KEY do servidor sem sessão. Agora exige sessão + contexto
  // de tenant, e resolve a config de extração do tenant ativo.
  const tctx = await requireTenantContext(req);
  if ('response' in tctx) return tctx.response;
  const { tenantId, userId } = tctx.ctx;

  // Rate limit por usuário: 10 extrações/minuto (mesmo padrão de extract-contract).
  const allowed = await rateLimit(`extract-pdf-debtor:${userId}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Limite de extrações por minuto excedido. Tente novamente em instantes.' },
      { status: 429 }
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const ai = await resolveAIConfig({
      client: admin ?? tctx.ctx.supabase,
      tenantId,
      bucket: 'pdf_extraction',
    });
    const apiKey = ai.apiKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave de API não configurada para extração de PDF. Configure o bucket 'Extração de PDF' do tenant ou o padrão de sistema." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado para análise." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || 'application/pdf';
    const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    let fileContent: Anthropic.Messages.ContentBlockParam;
    if (isPdf) {
      fileContent = {
        type: 'document',
        title: file.name,
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      };
    } else if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
      fileContent = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64,
        },
      };
    } else {
      return NextResponse.json(
        { error: "Formato de arquivo não suportado. Envie um PDF ou uma imagem JPEG, PNG, GIF ou WEBP." },
        { status: 400 }
      );
    }

    // O cliente de extração permanece single-SDK (Anthropic); apenas a baseURL
    // alterna entre o gateway OpenCode e a API nativa da Anthropic, conforme o
    // provedor resolvido. O validador de escrita (tasks 03/04) já restringe o
    // bucket pdf_extraction a provedores vision-capable (opencode/anthropic/
    // openai/gemini); opencode + minimax-m3 rodam via gateway OpenCode.
    const baseURL = ai.provider === 'anthropic' ? ANTHROPIC_BASE_URL : OPENCODE_BASE_URL;
    const anthropic = new Anthropic({ apiKey, baseURL });

    const response = await anthropic.messages.create({
      model: ai.model,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            { type: 'text', text: 'Extraia os dados dos devedores deste documento.' },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '{}';

    let extractedData: any[] = [];
    try {
      const parsed = JSON.parse(responseText);
      extractedData = parsed.debtors || parsed || [];
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          extractedData = parsed.debtors || parsed || [];
        } catch { /* keep empty */ }
      }
    }

    // Auditoria tenant-scoped da extração de devedores.
    try {
      await recordAuditAction(admin ?? tctx.ctx.supabase, {
        tenantId,
        entityType: 'debtor_extraction',
        entityId: 'unknown',
        actorUserId: userId,
        action: 'DEBTORS_EXTRACTED',
        metadata: {
          file_name: file.name || null,
          file_size: file.size || null,
          model: ai.model,
          provider: ai.provider,
          source: ai.source,
          debtors_count: extractedData.length,
        },
      }).catch(() => { /* auditoria não bloqueia extração */ });
    } catch { /* no-op */ }

    return NextResponse.json({
      success: true,
      debtors: extractedData,
    });
  } catch (err: any) {
    logger.error('Erro ao extrair PDF', { tenantId, userId }, { error: err instanceof Error ? err.message : String(err) });
    return serverError('extract-pdf error', err, true);
  }
}