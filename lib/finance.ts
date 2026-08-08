import { differenceInMonths, differenceInDays, parseISO } from 'date-fns';

export function calculateUpdatedValue(originalValue: number, dueDate: Date): number {
  const now = new Date();
  if (dueDate > now) {
    return originalValue; // Not overdue yet
  }
  
  // Basic calculation: 1% per month simple interest for the MVP
  const monthsOverdue = differenceInMonths(now, dueDate);
  if (monthsOverdue <= 0) return originalValue;

  const interestRate = 0.01; // 1% per month
  const interest = originalValue * interestRate * monthsOverdue;
  
  return originalValue + interest;
}

export interface CollectionStageInfo {
  id: 'preventiva' | 'amigavel' | 'negocial' | 'especializada';
  name: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  diasAtraso: number;
  effectiveMaxDiscount: number;
  objectives: string[];
  suggestedQuestions: string[];
}

export function getDaysOverdue(dueDate: Date | string): number {
  try {
    const parsedDate = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
    if (isNaN(parsedDate.getTime())) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    return differenceInDays(today, due);
  } catch (err) {
    return 0;
  }
}

export type FinancialTitleEligibilityReason = 'future' | 'today' | 'overdue' | 'paid' | 'cancelled';

export interface FinancialTitleEligibility {
  eligible: boolean;
  reason: FinancialTitleEligibilityReason;
  daysOverdue: number;
}

/** Regra de apresentação alinhada à RPC: vencimento hoje ainda não venceu. */
export function getFinancialTitleEligibility(
  dueDate: Date | string,
  status: string,
  today = new Date()
): FinancialTitleEligibility {
  const daysOverdue = getDaysOverdue(dueDate);
  const normalizedStatus = status.toLowerCase();

  if (['paid', 'settled', 'recovered', 'partial'].includes(normalizedStatus)) {
    return { eligible: false, reason: 'paid', daysOverdue };
  }
  if (['cancelled', 'canceled'].includes(normalizedStatus)) {
    return { eligible: false, reason: 'cancelled', daysOverdue };
  }

  const due = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
  const reference = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  if (dueDay > reference) return { eligible: false, reason: 'future', daysOverdue };
  if (dueDay.getTime() === reference.getTime()) return { eligible: false, reason: 'today', daysOverdue };
  return { eligible: true, reason: 'overdue', daysOverdue };
}

export function getCollectionStage(
  dueDate: Date | string,
  maxDiscountMargin: number = 10,
  status?: string
): CollectionStageInfo {
  const diasAtraso = getDaysOverdue(dueDate);

  // 1. Cobrança Especializada: Atraso > 180 dias OU já em atendimento humano/supervisor
  if (diasAtraso > 180 || status === 'needs_attention') {
    return {
      id: 'especializada',
      name: 'Cobrança Especializada',
      description: 'Dívida em estágio crítico (>180 dias) ou com suporte humano/supervisor. Envolve analistas, supervisores ou cobrança jurídica externa.',
      badgeBg: 'bg-purple-500/10',
      badgeText: 'text-purple-400',
      badgeBorder: 'border-purple-500/20',
      diasAtraso,
      effectiveMaxDiscount: Math.min(maxDiscountMargin, 20),
      objectives: [
        'Análise por equipe especializada/supervisão',
        'Preparação de histórico completo (dossiê)',
        'Cobrança extrajudicial/judicial ou parceiros externos'
      ],
      suggestedQuestions: [
        'Caso encaminhado para supervisão técnica.',
        'Aguardando contato de analista ou envio para parceiro jurídico.'
      ]
    };
  }

  // 2. Cobrança Preventiva: Cliente ainda NÃO está inadimplente (vencimento futuro ou hoje)
  if (diasAtraso <= 0) {
    return {
      id: 'preventiva',
      name: 'Cobrança Preventiva',
      description: 'Cliente ainda não está inadimplente. Foco em lembretes e prevenção de atrasos.',
      badgeBg: 'bg-teal-500/10',
      badgeText: 'text-teal-400',
      badgeBorder: 'border-teal-500/20',
      diasAtraso,
      effectiveMaxDiscount: 0, // Sem descontos antes do vencimento
      objectives: [
        'Lembrar do vencimento próximo',
        'Evitar atrasos acidentais',
        'Esclarecer dúvidas sobre boleto ou Pix',
        'Oferecer envio de 2ª via por WhatsApp'
      ],
      suggestedQuestions: [
        'Sua parcela vence em breve. Precisa que eu envie o Pix/boleto por WhatsApp?',
        'Tudo certo para o pagamento na data de vencimento?'
      ]
    };
  }

  // 3. Cobrança Amigável: Atraso de 1 a 30 dias
  if (diasAtraso <= 30) {
    return {
      id: 'amigavel',
      name: 'Cobrança Amigável',
      description: 'Atraso recente (1 a 30 dias). Abordagem empática para entender motivos e facilitar o pagamento.',
      badgeBg: 'bg-blue-500/10',
      badgeText: 'text-blue-400',
      badgeBorder: 'border-blue-500/20',
      diasAtraso,
      effectiveMaxDiscount: Math.min(maxDiscountMargin, 5), // Desconto máximo de 5%
      objectives: [
        'Entender o motivo do atraso',
        'Oferecer facilidades e 2ª via',
        'Ajustar melhor data para pagamento',
        'Manter bom relacionamento com cliente'
      ],
      suggestedQuestions: [
        'Houve algum problema com o recebimento do boleto?',
        'Deseja receber a segunda via atualizada por WhatsApp?',
        'Qual a melhor data para você efetuar o pagamento?',
        'Prefere parcelar o saldo em aberto?'
      ]
    };
  }

  // 4. Cobrança Negocial: Atraso de 31 a 180 dias
  // Regra de Negócio:
  // Se atraso <= 90 dias -> Desconto máximo 15%
  // Se atraso <= 180 dias -> Desconto até a margem autorizada
  const maxDiscountRule = diasAtraso <= 90 ? Math.min(maxDiscountMargin, 15) : maxDiscountMargin;

  return {
    id: 'negocial',
    name: 'Cobrança Negocial',
    description: 'Atraso prolongado (31 a 180 dias). Aplicação de políticas formais de negociação, juros e parcelamento.',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/20',
    diasAtraso,
    effectiveMaxDiscount: maxDiscountRule,
    objectives: [
      'Negociação estruturada com política de descontos',
      'Desconto sobre juros e encargos',
      'Opções flexíveis de parcelamento com entrada mínima',
      'Propostas diferenciadas para pagamento à vista'
    ],
    suggestedQuestions: [
      'Conseguimos um desconto especial para quitação à vista hoje.',
      'Podemos parcelar a dívida com uma entrada mínima ajustada ao seu orçamento.',
      'Qual valor de parcela fica confortável para o seu planejamento?'
    ]
  };
}

export function generateCaseDossier(
  caseData: {
    due_date: string | Date;
    max_discount_margin: number;
    status?: string;
    original_value?: number;
    updated_value?: number;
    name?: string;
    phone?: string;
    debtor_document?: string;
    debtor_email?: string;
    debtor_address?: string;
  },
  messages: { role: string; content: string; created_at?: string | Date }[]
): string {
  const stage = getCollectionStage(caseData.due_date, caseData.max_discount_margin, caseData.status);
  const formattedOriginal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(caseData.original_value || 0);
  const formattedUpdated = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(caseData.updated_value || 0);
  const minAcceptable = (caseData.updated_value || 0) * (1 - stage.effectiveMaxDiscount / 100);
  const formattedMin = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(minAcceptable);

  const historyLines = (messages || []).map(m => {
    const roleLabel = m.role === 'user' ? 'DEVEDOR' : m.role === 'ai' ? 'IA' : 'ATENDENTE';
    const dateStr = new Date(m.created_at as string).toLocaleString('pt-BR');
    return `[${dateStr}] ${roleLabel}: ${m.content}`;
  }).join('\n');

  return `==================================================
DOSSIÊ DE COBRANÇA - HISTÓRICO PARA SUPERVISOR / ESCRITÓRIO PARCEIRO
==================================================

1. DADOS DO CLIENTE & DÍVIDA
--------------------------------------------------
Nome do Devedor: ${caseData.name ?? 'Não informado'}
Telefone/WhatsApp: ${caseData.phone ?? 'Não informado'}
CPF/CNPJ: ${caseData.debtor_document || 'Não informado'}
E-mail: ${caseData.debtor_email || 'Não informado'}
Endereço: ${caseData.debtor_address || 'Não informado'}

2. RESUMO FINANCEIRO
--------------------------------------------------
Valor Original: ${formattedOriginal}
Data de Vencimento: ${new Date(caseData.due_date).toLocaleDateString('pt-BR')}
Dias em Atraso: ${stage.diasAtraso > 0 ? `${stage.diasAtraso} dia(s)` : 'Em dia / A vencer'}
Valor Atualizado: ${formattedUpdated}
Estágio Atual: ${stage.name}
Margem Autorizada (Regra): ${stage.effectiveMaxDiscount}% (Mínimo: ${formattedMin})

3. RESUMO DA SITUAÇÃO
--------------------------------------------------
Status Atual: ${caseData.status === 'needs_attention' ? 'Atendimento Humano / Requer Intervenção' : caseData.status === 'closed' ? 'Acordo Fechado' : 'Em Negociação'}
Total de Mensagens Trocadas: ${messages.length}

4. HISTÓRICO DAS INTERAÇÕES
--------------------------------------------------
${historyLines || 'Nenhuma mensagem registrada até o momento.'}

=================================================
Relatório gerado em: ${new Date().toLocaleString('pt-BR')}
==================================================`;
}
