import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext, serverError } from '@/lib/api-auth';
import { getDaysOverdue, getCollectionStage } from '@/lib/finance';
import type { CollectionStage } from '@/lib/types';
import { logger } from '@/lib/logger';

// pdfkit é CJS e não expõe tipos em runtime de servidor — import dinâmico evita
// que o bundler tente parsear no cliente.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGE_ORDER: CollectionStage[] = ['preventiva', 'amigavel', 'negocial', 'especializada'];
const STAGE_LABEL: Record<CollectionStage, string> = {
  preventiva: 'Preventiva',
  amigavel: 'Amigável',
  negocial: 'Negocial',
  especializada: 'Especializada',
};
const STYLE = {
  emerald: '#059669',
  blue: '#2563eb',
  amber: '#d97706',
  red: '#dc2626',
  slate: '#334155',
  muted: '#64748b',
  light: '#e2e8f0',
  headerBg: '#0f172a',
  boxBg: '#f8fafc',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type CaseRow = {
  status: string;
  due_date: string;
  updated_value: number | null;
  original_value: number | null;
  max_discount_margin: number | null;
};

function drawBarChart(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  items: { label: string; value: number; color: string }[]
) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const gap = 8;
  const barWidth = (width - gap * (items.length - 1)) / Math.max(1, items.length);
  const labelSpace = 16;

  // Eixo
  doc.moveTo(x, y).lineTo(x, y + height).strokeColor(STYLE.light).stroke();
  doc.moveTo(x, y + height).lineTo(x + width, y + height).strokeColor(STYLE.light).stroke();

  let cx = x;
  for (const item of items) {
    const barHeight = (item.value / max) * (height - labelSpace - 8);
    const by = y + height - labelSpace - barHeight;
    doc.roundedRect(cx, by, barWidth, barHeight, 2).fill(item.color);
    // Valor no topo da barra
    doc
      .fontSize(7)
      .fillColor(STYLE.slate)
      .text(String(item.value), cx - 4, by - 10, { width: barWidth + 8, align: 'center' });
    // Rótulo abaixo
    doc
      .fontSize(6.5)
      .fillColor(STYLE.muted)
      .text(item.label, cx - 4, y + height - labelSpace + 4, { width: barWidth + 8, align: 'center' });
    cx += barWidth + gap;
  }
  doc.fillColor('#000000');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantContext = await requireTenantContext(req, searchParams.get('tenant_id'));
    if ('response' in tenantContext) return tenantContext.response;
    const { supabase, tenantId } = tenantContext.ctx;

    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (from && Number.isNaN(new Date(from).getTime())) {
      return NextResponse.json({ error: 'Parâmetro "from" inválido.' }, { status: 400 });
    }
    if (to && Number.isNaN(new Date(to).getTime())) {
      return NextResponse.json({ error: 'Parâmetro "to" inválido.' }, { status: 400 });
    }

    // Tenant name para o cabeçalho
    const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
    const tenantName = tenant?.name || 'Meu Tenant';

    // Casos (fonte de verdade)
    let caseQuery = supabase
      .from('cases')
      .select('status, due_date, updated_value, original_value, max_discount_margin')
      .eq('tenant_id', tenantId);
    if (from) caseQuery = caseQuery.gte('created_at', from);
    if (to) caseQuery = caseQuery.lte('created_at', to);
    const { data: cases, error: casesError } = await caseQuery;
    if (casesError) throw casesError;
    const caseRows = (cases ?? []) as CaseRow[];

    const valueOf = (c: CaseRow) => Number(c.updated_value ?? c.original_value ?? 0) || 0;
    const totalCases = caseRows.length;
    const activeCases = caseRows.filter((c) => c.status !== 'closed');
    const closedCases = totalCases - activeCases.length;
    const pendingAmount = round2(activeCases.reduce((acc, c) => acc + valueOf(c), 0));

    // Títulos pagos = recuperação
    const titleQuery = supabase
      .from('financial_titles')
      .select('current_value, original_value')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .not('paid_at', 'is', null);
    const { data: paidTitles, error: titlesError } = await titleQuery;
    if (titlesError) throw titlesError;
    const recoveredAmount = round2(
      (paidTitles ?? []).reduce((acc: number, t: { current_value: number | null; original_value: number | null }) => {
        const v = Number(t.current_value) > 0 ? Number(t.current_value) : Number(t.original_value ?? 0);
        return acc + v;
      }, 0)
    );

    // Distribuição por estágio
    const stageMap = new Map<CollectionStage, number>(STAGE_ORDER.map((s) => [s, 0]));
    for (const c of activeCases) {
      const stage = getCollectionStage(c.due_date, Number(c.max_discount_margin ?? 10) || 10, c.status);
      stageMap.set(stage.id, (stageMap.get(stage.id) ?? 0) + 1);
    }
    const stageItems = STAGE_ORDER.map((s) => ({ label: STAGE_LABEL[s], value: stageMap.get(s) ?? 0 }));

    // Aging buckets
    const buckets: { label: string; value: number }[] = [
      { label: '0-30', value: 0 },
      { label: '31-90', value: 0 },
      { label: '91-180', value: 0 },
      { label: '180+', value: 0 },
    ];
    for (const c of activeCases) {
      const days = getDaysOverdue(c.due_date);
      if (days <= 0) continue;
      if (days <= 30) buckets[0].value += 1;
      else if (days <= 90) buckets[1].value += 1;
      else if (days <= 180) buckets[2].value += 1;
      else buckets[3].value += 1;
    }
    const bucketItems = buckets.map((b, i) => ({ label: b.label, value: b.value, color: [STYLE.emerald, STYLE.blue, STYLE.amber, STYLE.red][i] }));
    const stageColors: string[] = [STYLE.emerald, STYLE.blue, STYLE.amber, STYLE.red];
    const stageColored = stageItems.map((s, i) => ({ ...s, color: stageColors[i] }));

    const PDFKit = (await import('pdfkit')).default;
    const doc = new PDFKit({ size: 'A4', margin: 48, bufferPages: true });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    // ===== Cabeçalho =====
    doc.rect(0, 0, doc.page.width, 96).fill(STYLE.headerBg);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('Relatório de Recuperação', 48, 28);
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(`${tenantName} · Gerado em ${new Date().toLocaleString('pt-BR')}`, 48, 56, { lineBreak: false });

    const metaY = 124;
    const meta = [
      { label: 'Casos totais', value: String(totalCases), color: STYLE.slate },
      { label: 'Casos ativos', value: String(activeCases.length), color: STYLE.slate },
      { label: 'Recuperado', value: money.format(recoveredAmount), color: STYLE.emerald },
      { label: 'Em aberto', value: money.format(pendingAmount), color: STYLE.amber },
      { label: 'Encerrados', value: String(closedCases), color: STYLE.blue },
    ];
    const metaW = (doc.page.width - 96) / meta.length;
    meta.forEach((m, i) => {
      const x = 48 + i * metaW;
      doc.roundedRect(x, metaY, metaW - 10, 62, 6).fill(STYLE.boxBg);
      doc.strokeColor(STYLE.light).lineWidth(1).stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(STYLE.muted)
        .text(m.label.toUpperCase(), x + 10, metaY + 10, { width: metaW - 30 });
      doc.font('Helvetica-Bold').fontSize(15).fillColor(m.color).text(m.value, x + 10, metaY + 30, { width: metaW - 30 });
    });

    // ===== Gráfico 1: Estágio do funil =====
    let y = metaY + 90;
    doc.font('Helvetica-Bold').fontSize(13).fillColor(STYLE.slate).text('Distribuição por estágio do funil', 48, y);
    y += 8;
    doc.font('Helvetica').fontSize(8.5).fillColor(STYLE.muted).text(`Casos ativos por estágio de cobrança (${activeCases.length} ativos)`, 48, y);
    y += 26;
    drawBarChart(doc, 48, y, doc.page.width - 96, 130, stageColored);
    y += 160;

    if (y > doc.page.height - 180) doc.addPage();

    // ===== Gráfico 2: Aging =====
    doc.font('Helvetica-Bold').fontSize(13).fillColor(STYLE.slate).text('Carteira por idade do atraso', 48, y);
    y += 8;
    doc.font('Helvetica').fontSize(8.5).fillColor(STYLE.muted).text('Casos ativos vencidos por faixa de dias em atraso', 48, y);
    y += 26;
    drawBarChart(doc, 48, y, doc.page.width - 96, 130, bucketItems);
    y += 160;

    doc.font('Helvetica-Bold').fontSize(13).fillColor(STYLE.slate).text('Resumo executivo', 48, y);
    y += 10;
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(STYLE.slate)
      .text(
        `Carteira de ${tenantName} com ${totalCases} casos (${activeCases.length} ativos e ${closedCases} encerrados). ` +
          `Foram recuperados ${money.format(recoveredAmount)} em títulos quitados, restando ${money.format(pendingAmount)} em aberto. ` +
          `${STAGE_ORDER.map((s) => `${STAGE_LABEL[s]}: ${stageMap.get(s) ?? 0}`).join(' · ')}.`,
        48,
        y,
        { width: doc.page.width - 96, align: 'justify' }
      );

    const rangeLabel = from || to ? ` Período: ${from ? csvDateLocal(from) : 'início'} – ${to ? csvDateLocal(to) : 'hoje'}.` : '';
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(STYLE.muted)
      .text(`Documento gerado automaticamente pelo sistema de cobrança.${rangeLabel}`, 48, doc.page.height - 60);

    doc.end();
    const pdfBuffer = await done;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="relatorio-recuperacao.pdf"',
      },
    });
  } catch (error: unknown) {
    logger.error('[reports/recovery] exception', undefined, { error: error instanceof Error ? error.message : String(error) });
    return serverError('reports/recovery exception', error);
  }
}

function csvDateLocal(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
}