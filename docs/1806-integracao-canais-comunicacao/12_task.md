---
status: pending
title: UI: vinculação de Telegram nos clientes + canal ativo no caso
type: frontend
complexity: high
dependencies: ["9_task", "10_task"]
---

# UI: vinculação de Telegram nos clientes + canal ativo no caso

## Visão Geral

Duas frentes de UI: botão "Vincular Telegram" com modal de link copiável na listagem de clientes, e indicador/troca do canal ativo no detalhe do caso.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie a seção "Experiência do Usuário" do PRD (fluxos vincular o devedor e negociar por Telegram)
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `app/(dashboard)/clients/page.tsx` DEVE adicionar botão "Vincular Telegram" na célula de Ações (linhas 200-214), condicionado a `isAdmin` (mesmo guard dos botões editar/excluir), exibindo o estado atual dos canais do cliente (badges WhatsApp/Telegram quando vinculados).
2. Um modal (novo `components/clients/telegram-link-modal.tsx` no padrão de `components/clients/client-actions.tsx`) DEVE chamar `POST /api/clients/[id]/channel-links`, exibir o link copiável com aviso de expiração (48h) e botão "Copiar link" (clipboard API com fallback).
3. O modal DEVE tratar os erros da API com mensagem clara (ex.: canal não configurado → orientar ir a Configurações > Canais; rate limit → aguardar).
4. A listagem de clientes DEVE receber os canais vinculados: estender a resposta de `GET /api/clients` com `client_channels` aninhado (canal + verified_at, sem external_id) — modificar `app/api/clients/route.ts` quando necessário.
5. A página do caso (`app/(dashboard)/cases/[id]/page.tsx`) DEVE exibir o canal ativo do caso (a partir de `GET /api/cases/[id]` estendido na tarefa 10) com seletor para troca (`PATCH /api/cases/[id]` com `active_channel`), mostrando apenas canais vinculados do cliente; troca exige role gestor (o PATCH já exige) — esconder o controle para visualizadores.
6. A conversa do caso (histórico de mensagens) DEVE identificar o canal de cada mensagem (ícone/label WhatsApp/Telegram quando `message.channel` presente; mensagens sem canal exibem sem label) e mensagens com `send_status='failed'` DEVEM exibir aviso de falha com `status_error`.
7. Componentes DEVEM seguir o design system existente (classes Tailwind utilitárias do projeto, padrão visual das tabelas/modais de clients).
8. Strings de UI em pt-BR.
</requirements>

## Subtarefas

- [ ] Estender `GET /api/clients` com `client_channels` aninhado
- [ ] Badges de canais vinculados + botão "Vincular Telegram" na listagem
- [ ] Modal com link copiável, expiração e tratamento de erro
- [ ] Seletor de canal ativo no detalhe do caso
- [ ] Labels de canal e aviso de falha no histórico de mensagens do caso
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `components/clients/telegram-link-modal.tsx` — modal de vinculação

### Arquivos a Modificar

- `app/(dashboard)/clients/page.tsx` — badges + botão + modal
- `app/api/clients/route.ts` — resposta com `client_channels` aninhado
- `app/(dashboard)/cases/[id]/page.tsx` — seletor de canal ativo + labels de canal/falha no histórico
- `lib/types.ts` — tipos de resposta consumidos (se necessário)

### Arquivos Relevantes

- `app/(dashboard)/clients/page.tsx:113-221` — tabela e célula de Ações atual
- `components/clients/client-actions.tsx` — padrão de modal + `fetchWithAuth`
- `app/(dashboard)/cases/[id]/page.tsx` — detalhe do caso, `ObligationContextCard` e histórico de mensagens
- `app/api/clients/[id]/channel-links/route.ts` (tarefa 9) — contrato do link
- `app/api/cases/[id]/route.ts` (tarefa 10) — payload com canal ativo e canais do cliente

### Arquivos Dependentes

- Nenhum além dos listados

### ADRs Relacionados

- [ADR-002: Identidade de canal por cliente com canal ativo por caso](adrs/adr-002.md) — UX da vinculação por cliente e troca explícita

## Entregáveis

- [ ] Fluxo completo de geração de link na UI
- [ ] Seletor de canal ativo no caso
- [ ] Histórico com canal identificado e falhas visíveis

## Testes

### Testes de Integração (checklist manual — projeto sem suite)

- [ ] Gerar link na listagem → modal exibe `t.me/...?start=...` com expiração e copia para clipboard
- [ ] Cliente com Telegram não configurado no tenant → mensagem orientando configurar o canal
- [ ] Devedor completa `/start` → badge Telegram aparece no cliente após revalidação do SWR
- [ ] Trocar canal ativo no caso → próxima mensagem da IA sai pelo novo canal (validar no histórico com label do canal)
- [ ] Mensagem com falha (bot bloqueado) → aviso com motivo no histórico
- [ ] Visualizador (role abaixo de gestor) não vê o seletor de canal ativo

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Fluxo de ponta a ponta do PRD (configurar → vincular → negociar) executável só pela UI
