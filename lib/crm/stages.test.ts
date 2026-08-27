import { describe, expect, it } from 'vitest';
import {
  CRM_PRIORITIES,
  CRM_STAGE_META,
  CRM_STAGES,
  STAGE_TRANSITIONS,
  canTransition,
  statusForStage,
  type CrmStage,
} from './stages';

describe('CRM_STAGES', () => {
  it('contém as 11 etapas na ordem das colunas do board', () => {
    expect(CRM_STAGES).toHaveLength(11);
    expect([...CRM_STAGES]).toEqual([
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
    ]);
  });
});

describe('CRM_STAGE_META', () => {
  it('tem 11 entradas na ordem das colunas do board', () => {
    expect(CRM_STAGE_META).toHaveLength(11);
    expect(CRM_STAGE_META.map((meta) => meta.id)).toEqual([...CRM_STAGES]);
  });

  it('classifica etapas de fluxo antes das exceções com ordem sequencial', () => {
    const flowIds = ['NOVO', 'EM_CONTATO', 'EM_NEGOCIACAO', 'AGUARDANDO_PAGAMENTO', 'PAGAMENTO_CONFIRMADO', 'NEGOCIACAO_CONCLUIDA'];
    CRM_STAGE_META.forEach((meta, index) => {
      expect(meta.order).toBe(index);
      expect(meta.kind).toBe(flowIds.includes(meta.id) ? 'flow' : 'exception');
    });
  });

  it('todos os rótulos em pt-BR estão preenchidos', () => {
    for (const meta of CRM_STAGE_META) {
      expect(meta.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('STAGE_TRANSITIONS', () => {
  it('cobre todas as etapas como origem', () => {
    expect(Object.keys(STAGE_TRANSITIONS).sort()).toEqual([...CRM_STAGES].sort());
  });
});

describe('canTransition', () => {
  it('permite todas as arestas do mapa de transições', () => {
    for (const [from, targets] of Object.entries(STAGE_TRANSITIONS) as [CrmStage, readonly CrmStage[]][]) {
      for (const to of targets) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it('permite arestas-chave do funil', () => {
    expect(canTransition('NOVO', 'EM_CONTATO')).toBe(true);
    expect(canTransition('EM_NEGOCIACAO', 'AGUARDANDO_PAGAMENTO')).toBe(true);
    expect(canTransition('AGUARDANDO_PAGAMENTO', 'PAGAMENTO_CONFIRMADO')).toBe(true);
    expect(canTransition('PAGAMENTO_CONFIRMADO', 'NEGOCIACAO_CONCLUIDA')).toBe(true);
  });

  it('proíbe transições fora do mapa', () => {
    expect(canTransition('PAGAMENTO_CONFIRMADO', 'NOVO')).toBe(false);
    expect(canTransition('ENCERRADO', 'EM_NEGOCIACAO')).toBe(false);
    expect(canTransition('NOVO', 'EM_NEGOCIACAO')).toBe(false);
    expect(canTransition('NEGOCIACAO_CONCLUIDA', 'PAGAMENTO_CONFIRMADO')).toBe(false);
    expect(canTransition('NOVO', 'NOVO')).toBe(false);
  });

  it('ENCERRADO é terminal — nenhuma saída permitida', () => {
    expect(STAGE_TRANSITIONS.ENCERRADO).toEqual([]);
    for (const stage of CRM_STAGES) {
      expect(canTransition('ENCERRADO', stage)).toBe(false);
    }
  });
});

describe('statusForStage', () => {
  it('mapeia os 11 estágios para os 4 statuses conforme o TechSpec', () => {
    expect(statusForStage('NOVO')).toBe('not_started');
    expect(statusForStage('EM_CONTATO')).toBe('not_started');
    expect(statusForStage('SEM_CONTATO')).toBe('not_started');
    expect(statusForStage('EM_NEGOCIACAO')).toBe('in_negotiation');
    expect(statusForStage('AGUARDANDO_PAGAMENTO')).toBe('in_negotiation');
    expect(statusForStage('NEGOCIACAO_RECUSADA')).toBe('in_negotiation');
    expect(statusForStage('PROMESSA_NAO_CUMPRIDA')).toBe('in_negotiation');
    expect(statusForStage('ESCALADO')).toBe('needs_attention');
    expect(statusForStage('PAGAMENTO_CONFIRMADO')).toBe('closed');
    expect(statusForStage('NEGOCIACAO_CONCLUIDA')).toBe('closed');
    expect(statusForStage('ENCERRADO')).toBe('closed');
  });
});

describe('CRM_PRIORITIES', () => {
  it('define alta | media | baixa', () => {
    expect([...CRM_PRIORITIES]).toEqual(['alta', 'media', 'baixa']);
  });
});
