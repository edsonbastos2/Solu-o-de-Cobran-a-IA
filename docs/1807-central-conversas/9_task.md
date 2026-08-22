---
status: completed
title: Componentes da janela de conversa (chat, composer, takeover, transferência)
type: frontend
complexity: high
dependencies:
  - task_07
---

# Task 09: Componentes da janela de conversa

## Overview

Implementa a coluna central da Central: cabeçalho da conversa, timeline de mensagens (devedor/IA/humano/eventos de sistema), composer com atalhos de teclado, barra de takeover/devolução e dialog de transferência — o coração da experiência de intervenção humana do PRD.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar em `components/conversations/`: `chat-window.tsx`, `chat-header.tsx`, `message-list.tsx`, `message-bubble.tsx`, `system-message.tsx`, `message-composer.tsx`, `takeover-bar.tsx`, `transfer-dialog.tsx`
- MUST bolhas diferenciadas: devedor à esquerda; IA e humano à direita com identificação clara do remetente (🤖 IA de Cobrança / 👤 nome do operador) e timestamp; eventos de sistema centralizados (SystemMessage renderiza `ConversationEvent` — assumiu, devolveu, transferiu de/para/motivo)
- MUST composer: textarea auto-resize, Enter envia, Shift+Enter quebra linha, botão enviar, disabled (sem permissão ou enviando), loading, erro com retry, contador a partir de 3500/4000 chars
- MUST `TakeoverBar`: "IA está conduzindo" + botão Assumir (com dialog de confirmação) quando controller='ai'; "Você está conduzindo" + Devolver para IA (confirmação) quando humano; estados de loading por ação; exibe conflito 409 com ação de atualizar
- MUST `TransferDialog`: responsável atual, seletor de operadores (mesmo tenant, ativos), motivo opcional, confirmar/cancelar; só visível com permissão canTransfer
- MUST rolagem automática para a última mensagem (respeitando scroll manual do operador — não roubar scroll se ele subiu o feed)
- MUST mensagens agrupadas por remetente consecutivo com timestamp; status de envio (enviando/enviada/falha) na bolha própria
- MUST indicador "🤖 IA está analisando a conversa..." quando mensagem do devedor aguardando resposta da IA
- MUST acessibilidade: feed com `role="log"` + `aria-live`, foco no composer, dialogs com foco preso (implementação própria simples ou `<dialog>`), Esc fecha
- Componentes puros: dados e ações via props dos hooks (task 07)
</requirements>

## Subtasks
- [x] 9.1 `chat-header.tsx` + `chat-window.tsx` (composição + rolagem + estados)
- [x] 9.2 `message-list.tsx` + `message-bubble.tsx` + `system-message.tsx` (agrupamento, diferenciação, status)
- [x] 9.3 `message-composer.tsx` (atalhos, disabled, loading, erro)
- [x] 9.4 `takeover-bar.tsx` (banner + confirmações + 409)
- [x] 9.5 `transfer-dialog.tsx`
- [x] 9.6 Testes RTL de todos os fluxos

## Implementation Details

Bolhas: devedor `bg-muted` à esquerda; IA/humano à direita com badges distintos (IA sempre identificada — nunca parecer humano). SystemMessage interpola payload do evento (fromOperatorId/toOperatorId/reason resolvidos para nomes recebidos no detalhe). Dialogs: implementação leve própria (portal + foco) — sem Radix; YAGNI. Sombra/borda só no necessário (identidade SaaS densa, sem excessos).

### Relevant Files
- `app/(dashboard)/cases/[id]/page.tsx` — renderização atual de mensagens por role (linhas ~1100+) a evoluir, não copiar
- `components/conversation-*` (task 08) — não acoplar
- `lib/types.ts` — `Message`, `ConversationEvent`, `ConversationPermissions`

### Dependent Files
- `app/(dashboard)/conversations/page.tsx` (task 10)

### Related ADRs
- [ADR-001: Conversa = caso enriquecido](../adrs/adr-001.md)
- [ADR-003: Ações com concorrência otimista](../adrs/adr-003.md)

## Deliverables
- 8 componentes + testes co-localizados

## Tests
- Unit tests:
  - [x] MessageBubble por role: devedor esquerda; IA à direita com identificação "IA"; humano à direita com nome do operador
  - [x] SystemMessage TRANSFERRED renderiza "de X para Y" + motivo quando presente
  - [x] Composer: Enter envia; Shift+Enter insere quebra; disabled não envia; erro mostra retry; texto vazio não envia
  - [x] TakeoverBar controller='ai': botão Assumir abre confirmação; confirmar chama onTakeOver
  - [x] TakeoverBar humano conduzindo: botão Devolver com confirmação; 409 exibe mensagem de conflito
  - [x] TransferDialog: visibilidade controlada pelo pai via canTransfer (renderizado apenas com `open`); motivo opcional; confirmar chama onTransfer com toOperatorId
  - [x] MessageList agrupa mensagens consecutivas do mesmo remetente
  - [x] Auto-scroll para o fim ao chegar mensagem nova (respeita scroll manual — implementado via `isNearBottomRef`, não coberto por teste RTL por exigir medições de layout que o jsdom não fornece)
- Integration tests:
  - [ ] N/A
- Test coverage target: >=80%
- All tests must pass — 114/114 (`npm test`), `npx tsc --noEmit` limpo

## Success Criteria
- All tests passing
- Fluxo assumir → enviar → devolver navegável só por teclado; dialogs com foco preso (Escape fecha, foco inicial no botão de confirmação/select)

## Nota de implementação
`TransferDialog` é a UI do dialog em si (controlada por `open`); o gate de permissão `canTransfer` é aplicado pelo componente pai (`ChatWindow`/`TakeoverBar`), que só renderiza o botão-gatilho "Transferir" quando a permissão está presente — consistente com o padrão dos demais componentes desta task (dados/permissões via props, sem lógica de fetch).
