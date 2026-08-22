import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConversationFilters, CONVERSATION_FILTER_LABELS } from './conversation-filters';
import type { ConversationFilter } from '@/lib/types';

afterEach(cleanup);

const OPERATORS = [
  { id: 'op-1', name: 'Ana Operadora', role: 'member' },
  { id: 'op-2', name: 'Bruno Gestor', role: 'admin' },
];

function setupFilter(filter: ConversationFilter = 'all') {
  const onFilterChange = vi.fn();
  const onSearchChange = vi.fn();
  const onAssigneeChange = vi.fn();
  return {
    onFilterChange,
    onSearchChange,
    onAssigneeChange,
    ...render(
      <ConversationFilters
        filter={filter}
        onFilterChange={onFilterChange}
        search=""
        onSearchChange={onSearchChange}
        showAssignee={false}
        operators={OPERATORS}
        onAssigneeChange={onAssigneeChange}
      />
    ),
  };
}

describe('ConversationFilters', () => {
  it('renderiza todos os filtros com labels em pt-BR', () => {
    setupFilter();

    for (const label of Object.values(CONVERSATION_FILTER_LABELS)) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marca o filtro ativo com aria-pressed', () => {
    setupFilter('unread');

    expect(screen.getByRole('button', { name: 'Não lidas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicar em "Não lidas" chama onFilterChange com valor correto', () => {
    const { onFilterChange } = setupFilter();

    fireEvent.click(screen.getByRole('button', { name: 'Não lidas' }));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith('unread');
  });

  it('campo de busca com aria-label propaga alterações', () => {
    const { onSearchChange } = setupFilter();

    const input = screen.getByLabelText('Buscar conversas');
    fireEvent.change(input, { target: { value: 'maria' } });
    expect(onSearchChange).toHaveBeenCalledWith('maria');
  });

  it('oculta filtro por responsável quando showAssignee é false', () => {
    setupFilter();

    expect(screen.queryByLabelText('Filtrar por responsável')).not.toBeInTheDocument();
  });

  it('exibe select de responsável e propaga alteração quando showAssignee é true', () => {
    const onFilterChange = vi.fn();
    const onSearchChange = vi.fn();
    const onAssigneeChange = vi.fn();
    render(
      <ConversationFilters
        filter="all"
        onFilterChange={onFilterChange}
        search=""
        onSearchChange={onSearchChange}
        showAssignee={true}
        assignee=""
        onAssigneeChange={onAssigneeChange}
        operators={OPERATORS}
      />
    );

    const select = screen.getByLabelText('Filtrar por responsável');
    expect(screen.getByRole('option', { name: 'Todos os responsáveis' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana Operadora' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'op-1' } });
    expect(onAssigneeChange).toHaveBeenCalledWith('op-1');
  });
});

describe('ConversationFilters — roda do mouse na régua de chips', () => {
  /** jsdom não faz layout: scrollWidth/clientWidth são sempre 0, então precisam ser forjados. */
  function setupChips({ scrollWidth = 600, clientWidth = 300, scrollLeft = 0 } = {}) {
    setupFilter();
    const chips = screen.getByTestId('conversation-filter-chips');
    Object.defineProperty(chips, 'scrollWidth', { value: scrollWidth, configurable: true });
    Object.defineProperty(chips, 'clientWidth', { value: clientWidth, configurable: true });
    chips.scrollLeft = scrollLeft;
    return chips;
  }

  function wheel(el: HTMLElement, init: WheelEventInit) {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(event);
    return event;
  }

  it('roda vertical rola os chips na horizontal e consome o evento', () => {
    const chips = setupChips();

    const event = wheel(chips, { deltaY: 120 });

    expect(chips.scrollLeft).toBe(120);
    expect(event.defaultPrevented).toBe(true);
  });

  it('normaliza deltaMode em linhas (Firefox) para pixels', () => {
    const chips = setupChips();

    wheel(chips, { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });

    expect(chips.scrollLeft).toBe(48);
  });

  it('não ultrapassa o fim da régua e libera o evento quando já está na ponta', () => {
    const chips = setupChips({ scrollLeft: 300 });

    const event = wheel(chips, { deltaY: 120 });

    expect(chips.scrollLeft).toBe(300);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignora Ctrl+roda para não sequestrar o zoom do navegador', () => {
    const chips = setupChips();

    const event = wheel(chips, { deltaY: 120, ctrlKey: true });

    expect(chips.scrollLeft).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignora gesto já horizontal do trackpad', () => {
    const chips = setupChips();

    const event = wheel(chips, { deltaX: 90, deltaY: 10 });

    expect(chips.scrollLeft).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('não faz nada quando os chips cabem sem overflow', () => {
    const chips = setupChips({ scrollWidth: 300, clientWidth: 300 });

    const event = wheel(chips, { deltaY: 120 });

    expect(chips.scrollLeft).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});
