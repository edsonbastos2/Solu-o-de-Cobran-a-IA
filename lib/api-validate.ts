import { NextResponse } from 'next/server';

/** Valida campos obrigatórios e tipos básicos. Retorna null se ok, ou NextResponse 400. */
export function validateFields(
  body: Record<string, unknown>,
  required: { name: string; type: 'string' | 'number' | 'boolean' | 'uuid' }[]
): NextResponse | null {
  for (const f of required) {
    const v = body?.[f.name];
    if (v === undefined || v === null || v === '') {
      return NextResponse.json({ error: `Campo obrigatório ausente: ${f.name}` }, { status: 400 });
    }
    if (f.type === 'string' && typeof v !== 'string') {
      return NextResponse.json({ error: `Campo inválido: ${f.name}` }, { status: 400 });
    }
    if (f.type === 'number' && (typeof v !== 'number' || isNaN(v))) {
      return NextResponse.json({ error: `Campo numérico inválido: ${f.name}` }, { status: 400 });
    }
    if (f.type === 'boolean' && typeof v !== 'boolean') {
      return NextResponse.json({ error: `Campo booleano inválido: ${f.name}` }, { status: 400 });
    }
    if (f.type === 'uuid' && typeof v === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
      return NextResponse.json({ error: `UUID inválido: ${f.name}` }, { status: 400 });
    }
  }
  return null;
}

/** Sanitiza string: trim + remove caracteres de controle. */
export function sanitizeString(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\x00-\x1F\x7F]/g, '').trim();
}