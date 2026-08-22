import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SystemMessage } from './system-message';
import type { ConversationEvent } from '@/lib/types';

afterEach(cleanup);

function buildEvent(overrides: Partial<ConversationEvent> = {}): ConversationEvent {
  return {
    id: 'evt-1',
    tenant_id: 'tenant-1',
    case_id: 'case-1',
    type: 'HUMAN_TAKEOVER',
    performed_by: 'user-1',
    created_at: '2026-08-20T14:32:00Z',
    ...overrides,
  };
}

const resolveName = (id: string | null | undefined) => (id === 'user-1' ? 'Ana Operadora' : id === 'user-2' ? 'Bruno Gestor' : 'Sistema');

describe('SystemMessage', () => {
  it('renderiza HUMAN_TAKEOVER com o nome de quem assumiu', () => {
    render(<SystemMessage event={buildEvent()} resolveName={resolveName} />);
    expect(screen.getByText(/Ana Operadora assumiu a conversa/)).toBeInTheDocument();
  });

  it('renderiza TRANSFERRED com "de X para Y" e motivo quando presente', () => {
    render(
      <SystemMessage
        event={buildEvent({
          type: 'TRANSFERRED',
          payload: { fromOperatorId: 'user-1', toOperatorId: 'user-2', reason: 'Alçada de gestor' },
        })}
        resolveName={resolveName}
      />
    );
    expect(screen.getByText(/de Ana Operadora para Bruno Gestor/)).toBeInTheDocument();
    expect(screen.getByText(/Alçada de gestor/)).toBeInTheDocument();
  });

  it('renderiza TRANSFERRED sem motivo quando ausente', () => {
    render(
      <SystemMessage
        event={buildEvent({ type: 'TRANSFERRED', payload: { fromOperatorId: 'user-1', toOperatorId: 'user-2' } })}
        resolveName={resolveName}
      />
    );
    expect(screen.getByTestId('system-message-evt-1')).not.toHaveTextContent('—');
  });

  it('não renderiza nada para MESSAGE_RECEIVED', () => {
    const { container } = render(<SystemMessage event={buildEvent({ type: 'MESSAGE_RECEIVED' })} resolveName={resolveName} />);
    expect(container).toBeEmptyDOMElement();
  });
});
