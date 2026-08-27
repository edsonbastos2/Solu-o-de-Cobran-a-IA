export const CRM_STAGES = [
  'NOVO',
  'EM_CONTATO',
  'EM_NEGOCIACAO',
  'AGUARDANDO_PAGAMENTO',
  'PAGAMENTO_CONFIRMADO',
  'NEGOCIACAO_CONCLUIDA',
  'SEM_CONTATO',
  'NEGOCIACAO_RECUSADA',
  'PROMESSA_NAO_CUMPRIDA',
  'ESCALADO',
  'ENCERRADO',
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

export type CaseStatus = 'not_started' | 'in_negotiation' | 'needs_attention' | 'closed';

export interface CrmStageMeta {
  id: CrmStage;
  label: string;
  kind: 'flow' | 'exception';
  order: number;
}

export const CRM_STAGE_META: CrmStageMeta[] = [
  { id: 'NOVO', label: 'Novo', kind: 'flow', order: 0 },
  { id: 'EM_CONTATO', label: 'Em contato', kind: 'flow', order: 1 },
  { id: 'EM_NEGOCIACAO', label: 'Em negociação', kind: 'flow', order: 2 },
  { id: 'AGUARDANDO_PAGAMENTO', label: 'Aguardando pagamento', kind: 'flow', order: 3 },
  { id: 'PAGAMENTO_CONFIRMADO', label: 'Pagamento confirmado', kind: 'flow', order: 4 },
  { id: 'NEGOCIACAO_CONCLUIDA', label: 'Negociação concluída', kind: 'flow', order: 5 },
  { id: 'SEM_CONTATO', label: 'Sem contato', kind: 'exception', order: 6 },
  { id: 'NEGOCIACAO_RECUSADA', label: 'Negociação recusada', kind: 'exception', order: 7 },
  { id: 'PROMESSA_NAO_CUMPRIDA', label: 'Promessa não cumprida', kind: 'exception', order: 8 },
  { id: 'ESCALADO', label: 'Escalado', kind: 'exception', order: 9 },
  { id: 'ENCERRADO', label: 'Encerrado', kind: 'exception', order: 10 },
];

export const STAGE_TRANSITIONS: Readonly<Record<CrmStage, readonly CrmStage[]>> = {
  NOVO: ['EM_CONTATO', 'SEM_CONTATO', 'ESCALADO', 'ENCERRADO'],
  EM_CONTATO: ['EM_NEGOCIACAO', 'SEM_CONTATO', 'ESCALADO', 'ENCERRADO'],
  EM_NEGOCIACAO: ['AGUARDANDO_PAGAMENTO', 'NEGOCIACAO_RECUSADA', 'SEM_CONTATO', 'ESCALADO', 'ENCERRADO'],
  AGUARDANDO_PAGAMENTO: ['PAGAMENTO_CONFIRMADO', 'PROMESSA_NAO_CUMPRIDA', 'EM_NEGOCIACAO', 'ESCALADO', 'ENCERRADO'],
  PAGAMENTO_CONFIRMADO: ['NEGOCIACAO_CONCLUIDA', 'ENCERRADO'],
  NEGOCIACAO_CONCLUIDA: ['ENCERRADO'],
  SEM_CONTATO: ['EM_CONTATO', 'EM_NEGOCIACAO', 'ESCALADO', 'ENCERRADO'],
  NEGOCIACAO_RECUSADA: ['EM_NEGOCIACAO', 'ESCALADO', 'ENCERRADO'],
  PROMESSA_NAO_CUMPRIDA: ['EM_NEGOCIACAO', 'AGUARDANDO_PAGAMENTO', 'ESCALADO', 'ENCERRADO'],
  ESCALADO: ['EM_CONTATO', 'EM_NEGOCIACAO', 'ENCERRADO'],
  ENCERRADO: [],
};

export function canTransition(from: CrmStage, to: CrmStage): boolean {
  return STAGE_TRANSITIONS[from].includes(to);
}

const STAGE_STATUS: Readonly<Record<CrmStage, CaseStatus>> = {
  NOVO: 'not_started',
  EM_CONTATO: 'not_started',
  SEM_CONTATO: 'not_started',
  EM_NEGOCIACAO: 'in_negotiation',
  AGUARDANDO_PAGAMENTO: 'in_negotiation',
  NEGOCIACAO_RECUSADA: 'in_negotiation',
  PROMESSA_NAO_CUMPRIDA: 'in_negotiation',
  ESCALADO: 'needs_attention',
  PAGAMENTO_CONFIRMADO: 'closed',
  NEGOCIACAO_CONCLUIDA: 'closed',
  ENCERRADO: 'closed',
};

export function statusForStage(stage: CrmStage): CaseStatus {
  return STAGE_STATUS[stage];
}

export const CRM_PRIORITIES = ['alta', 'media', 'baixa'] as const;

export type CrmPriority = (typeof CRM_PRIORITIES)[number];
