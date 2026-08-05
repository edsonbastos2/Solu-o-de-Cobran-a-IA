import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1';

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
  try {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave de API do OpenCode não configurada (OPENCODE_API_KEY)." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const contractText = formData.get("contractText") as string;
    const file = formData.get("file") as File | null;

    if (!contractText && !file) {
      return NextResponse.json({ error: "contractText or file is required" }, { status: 400 });
    }

    let userContent = "";
    if (contractText) {
      userContent = contractText;
    }

    const openai = new OpenAI({ apiKey, baseURL: OPENCODE_BASE_URL });

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const mimeType = file.type;

      const response = await openai.chat.completions.create({
        model: "deepseek-v4-pro",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userContent || "Extraia os dados deste contrato." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return NextResponse.json(result);
    } else {
      const response = await openai.chat.completions.create({
        model: "deepseek-v4-pro",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: userContent }
        ],
        temperature: 0,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return NextResponse.json(result);
    }
  } catch (error: any) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
