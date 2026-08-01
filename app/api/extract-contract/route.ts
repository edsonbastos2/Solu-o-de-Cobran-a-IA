import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const contractText = formData.get("contractText") as string;
    const file = formData.get("file") as File | null;

    if (!contractText && !file) {
      return NextResponse.json({ error: "contractText or file is required" }, { status: 400 });
    }

    let contents: any[] = [];
    
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      contents.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: file.type,
        }
      });
    }

    if (contractText) {
      contents.push(contractText);
    }

    contents.push(`You are an expert lawyer and data extraction assistant. Extract the following information from the contract provided above. If a field is not found, leave it empty or null.`);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            client_name: { type: Type.STRING },
            client_document: { type: Type.STRING },
            client_address: { type: Type.STRING },
            client_phone: { type: Type.STRING },
            client_email: { type: Type.STRING },
            contract_number: { type: Type.STRING },
            type: { type: Type.STRING },
            start_date: { type: Type.STRING },
            due_date: { type: Type.STRING },
            total_value: { type: Type.NUMBER },
            installments_count: { type: Type.NUMBER },
            interest_rate: { type: Type.NUMBER },
            penalty_rate: { type: Type.NUMBER },
            monetary_correction_index: { type: Type.STRING },
            guarantees: { type: Type.STRING },
            guarantors: { type: Type.STRING },
            negative_allowed: { type: Type.BOOLEAN },
            protest_allowed: { type: Type.BOOLEAN },
            forum: { type: Type.STRING }
          },
          required: ["client_name", "client_document"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

