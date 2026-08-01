import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave de API do Gemini não configurada no servidor (GEMINI_API_KEY)." },
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

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analise este documento (PDF ou Imagem) e extraia todas as informações de devedores / clientes com débitos.
Retorne uma lista JSON com os devedores encontrados.
Para cada devedor, extraia os seguintes campos se disponíveis:
- name: Nome completo ou Razão Social
- phone: Número de telefone/WhatsApp com DDD (somente dígitos com DDD ou formatado)
- email: E-mail do devedor
- document: CPF ou CNPJ
- address: Endereço completo (Rua, Número, Bairro, Cidade, Estado, CEP)
- notes: Informações adicionais relevantes, como número do contrato, título ou detalhes da dívida

Se um campo não for identificado, use string vazia "".
Mantenha a lista o mais precisa e completa possível.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType === "application/octet-stream" ? "application/pdf" : mimeType,
            data: buffer.toString("base64"),
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Lista de devedores extraídos do documento",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nome do devedor" },
              phone: { type: Type.STRING, description: "Telefone ou WhatsApp" },
              email: { type: Type.STRING, description: "Email do devedor" },
              document: { type: Type.STRING, description: "CPF ou CNPJ" },
              address: { type: Type.STRING, description: "Endereço completo" },
              notes: { type: Type.STRING, description: "Observações ou contrato" },
            },
            required: ["name", "phone"],
          },
        },
      },
    });

    const responseText = response.text || "[]";
    let extractedData = [];
    try {
      extractedData = JSON.parse(responseText);
    } catch {
      extractedData = [];
    }

    return NextResponse.json({
      success: true,
      debtors: extractedData,
    });
  } catch (err: any) {
    console.error("Erro ao extrair PDF via Gemini:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao processar o arquivo PDF/imagem." },
      { status: 500 }
    );
  }
}
