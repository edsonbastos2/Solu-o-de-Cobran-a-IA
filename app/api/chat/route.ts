import { NextRequest, NextResponse } from 'next/server';
import { processChat } from '@/lib/agent';

export async function POST(req: NextRequest) {
  try {
    const { caseId, message } = await req.json();
    
    const result = await processChat(caseId, message);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
