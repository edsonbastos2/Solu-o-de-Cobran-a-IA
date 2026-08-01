import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DEFAULT_AGENTS, AgentConfig } from '@/lib/multi-agent';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!supabase) {
      return NextResponse.json({ agents: DEFAULT_AGENTS });
    }

    let query = supabase.from('agents').select('*');
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ agents: DEFAULT_AGENTS });
    }

    return NextResponse.json({ agents: data });
  } catch (error: any) {
    console.error("GET Agents error:", error);
    return NextResponse.json({ agents: DEFAULT_AGENTS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!supabase) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
    }

    // Check if reset defaults is requested
    if (body.action === 'reset_defaults') {
      const { userId } = body;
      
      if (userId) {
        await supabase.from('agents').delete().eq('user_id', userId);
      }

      // Insert defaults for user
      const agentsToInsert = DEFAULT_AGENTS.map(agent => ({
        ...agent,
        id: undefined, // Let Supabase generate UUID
        user_id: userId || null
      }));

      const { data, error } = await supabase.from('agents').insert(agentsToInsert).select();
      if (error) throw error;

      return NextResponse.json({ agents: data || DEFAULT_AGENTS });
    }

    // Single agent creation
    const {
      name,
      role_type,
      icon,
      color,
      description,
      system_prompt,
      model,
      temperature,
      max_discount,
      tone,
      is_active,
      user_id
    } = body;

    if (!name || !role_type || !system_prompt) {
      return NextResponse.json({ error: "Nome, tipo e prompt do sistema são obrigatórios." }, { status: 400 });
    }

    const newAgent = {
      name,
      role_type,
      icon: icon || 'Bot',
      color: color || 'bg-blue-600',
      description: description || '',
      system_prompt,
      model: model || 'gemini-3.5-flash',
      temperature: temperature !== undefined ? Number(temperature) : 0.2,
      max_discount: max_discount !== undefined ? Number(max_discount) : 10,
      tone: tone || 'profissional',
      is_active: is_active !== undefined ? is_active : true,
      user_id: user_id || null
    };

    const { data, error } = await supabase.from('agents').insert([newAgent]).select().single();

    if (error) throw error;

    return NextResponse.json({ agent: data });
  } catch (error: any) {
    console.error("POST Agent error:", error);
    return NextResponse.json({ error: error.message || "Erro ao criar agente." }, { status: 500 });
  }
}
