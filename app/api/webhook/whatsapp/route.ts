import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Handle incoming messages from Z-API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if it's a message received event from Z-API (and not from ourselves)
    if (body.fromMe) {
      return NextResponse.json({ ok: true });
    }

    // Usually Z-API text messages are inside a 'text' object with a 'message' field
    const text = body.text?.message || body.text; 
    const from = body.phone; // Sender's phone number, e.g., '5511999999999'

    if (!text || !from) {
      return NextResponse.json({ ok: true });
    }

    console.log(`Received Z-API message from ${from}: ${text}`);

    if (!supabase) {
      console.error("Supabase not configured.");
      return NextResponse.json({ ok: true });
    }

    // Strip country code for matching (assuming Brazilian +55) if it starts with 55
    let phoneToMatch = from;
    if (phoneToMatch.startsWith('55') && phoneToMatch.length > 10) {
      phoneToMatch = phoneToMatch.substring(2);
    }

    // Try to find an open case matching the phone number
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('*')
      .or(`status.eq.not_started,status.eq.in_negotiation,status.eq.needs_attention`)
      .like('phone', `%${phoneToMatch}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (casesError || !cases || cases.length === 0) {
      console.log(`No active case found for phone: ${from}`);
      return NextResponse.json({ ok: true });
    }

    const currentCase = cases[0];

    // If case is in human intervention mode (needs_attention), just record the message and do not invoke Gemini AI
    if (currentCase.status === 'needs_attention') {
      console.log(`Case ${currentCase.id} is in human intervention mode. Storing debtor message without invoking AI.`);
      await supabase.from('messages').insert({
        case_id: currentCase.id,
        role: 'user',
        content: text
      });
      return NextResponse.json({ ok: true });
    }

    // Trigger the chat logic internally by calling our own API
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const chatRes = await fetch(`${appUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: currentCase.id, message: text })
    });

    if (!chatRes.ok) {
      console.error("Internal chat API error:", await chatRes.text());
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Z-API Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
