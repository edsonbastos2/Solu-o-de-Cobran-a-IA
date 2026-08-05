import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type || "application/pdf";

    const openai = new OpenAI({ apiKey, baseURL: OPENCODE_BASE_URL });

    const response = await openai.chat.completions.create({
      model: "deepseek-v4-pro",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType === "application/octet-stream" ? "application/pdf" : mimeType};base64,${buffer.toString("base64")}`
              }
            }
          ]
        }
      ],
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: "json_object" }
    });

    const responseText = response.choices[0].message.content || "{}";
    let extractedData = [];
    try {
      const parsed = JSON.parse(responseText);
      extractedData = parsed.debtors || parsed || [];
    } catch {
      extractedData = [];
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
