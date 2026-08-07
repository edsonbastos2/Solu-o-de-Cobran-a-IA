import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go';

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

const MODEL = 'minimax-m3';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave de API do OpenCode não configurada no servidor (OPENCODE_API_KEY)." },
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

    const anthropic = new Anthropic({ apiKey, baseURL: OPENCODE_BASE_URL });

    const response = await anthropic.messages.create({
      model: MODEL,
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

    return NextResponse.json({
      success: true,
      debtors: extractedData,
    });
  } catch (err: any) {
    console.error("Erro ao extrair PDF via OpenCode:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao processar o arquivo PDF/imagem." },
      { status: 500 }
    );
  }
}
