import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!supabase) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
    }

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
      is_active
    } = body;

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (role_type !== undefined) updateData.role_type = role_type;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (description !== undefined) updateData.description = description;
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
    if (model !== undefined) updateData.model = model;
    if (temperature !== undefined) updateData.temperature = Number(temperature);
    if (max_discount !== undefined) updateData.max_discount = Number(max_discount);
    if (tone !== undefined) updateData.tone = tone;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ agent: data });
  } catch (error: any) {
    console.error("PUT Agent error:", error);
    return NextResponse.json({ error: error.message || "Erro ao atualizar agente." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!supabase) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
    }

    const { error } = await supabase.from('agents').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Agent error:", error);
    return NextResponse.json({ error: error.message || "Erro ao remover agente." }, { status: 500 });
  }
}
