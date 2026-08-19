---
status: pending
title: UI: aba Canais em Configurações
type: frontend
complexity: high
dependencies: ["8_task"]
---

# UI: aba Canais em Configurações

## Visão Geral

Nova aba "Canais" na página de Configurações com painel dedicado (`components/channel-config-panel.tsx`) para configurar WhatsApp e Telegram por tenant: segredos mascarados, status do webhook, habilitar/desabilitar e migração one-shot visível.

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie a seção "Experiência do Usuário" do PRD (fluxo configurar o Telegram)
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. `app/(dashboard)/settings/page.tsx` DEVE estender o union type da aba (linha 14) com `'channels'`, adicionar o botão na sidebar (visível para `owner`/`admin` — mesmo guard de `canManageTeam`) e o ramo de renderização com `<ChannelConfigPanel />`.
2. `components/channel-config-panel.tsx` DEVE seguir o padrão de `components/tenant-ai-config-panel.tsx`: `useActiveTenant()` para tenantId/tenantQuery/isAdmin, `fetchWithAuth` em `useEffect` + `useState` (sem SWR, consistente com os painéis de settings).
3. O painel DEVE renderizar um cartão por canal (Telegram e WhatsApp) com: status habilitado (toggle), campos de credencial com placeholder "configurado" quando a flag `*_set` for true (inputs vazios que só enviam quando preenchidos — padrão da aba Perfil linhas 107-114), `bot_username` e `webhook_status` do Telegram (badge textual: Ativo/Erro/Não registrado + `webhook_last_error` quando houver).
4. O salvamento DEVE chamar `PUT /api/tenants/[id]/channel-configs` com apenas os campos alterados; após sucesso, recarregar o GET (padrão do painel de IA linhas 78-86) e limpar os inputs de segredo.
5. O cartão do Telegram DEVE incluir instrução curta de como obter um token (@BotFather) em pt-BR.
6. Estado de erro/sucesso DEVE usar feedback inline textual (padrão dos painéis existentes); status de webhook com erro exibe a mensagem do backend.
7. Acessibilidade: status de canal/webhook em texto + cor, não só cor (requisito do PRD).
8. O painel DEVE exibir aviso quando a migração one-shot acabou de copiar credenciais do perfil (flag `migrated_at` recente) — simples banner informativo.
9. Slots futuros (E-mail, SMS) NÃO DEVEM aparecer (PRD: não-objetivo).
</requirements>

## Subtarefas

- [ ] Estender tabs em `settings/page.tsx` (union, botão, render condicional)
- [ ] Criar `components/channel-config-panel.tsx` com cartões Telegram/WhatsApp
- [ ] Fluxo de salvar com segredos opcionais + recarga
- [ ] Badges de status com acessibilidade (texto + cor)
- [ ] Compilar e lintar

## Detalhes de Implementação

### Arquivos a Criar

- `components/channel-config-panel.tsx` — painel da aba Canais

### Arquivos a Modificar

- `app/(dashboard)/settings/page.tsx` — nova aba

### Arquivos Relevantes

- `components/tenant-ai-config-panel.tsx` — padrão de painel de settings (fetch, save, reload, useActiveTenant)
- `app/(dashboard)/settings/page.tsx:14,149-184` — mecanismo de tabs e guard `canManageTeam`
- `app/(dashboard)/settings/page.tsx:60-126` — padrão de envio de segredos opcionais (handleSave)
- `hooks/use-active-tenant.ts` — `tenantId`/`tenantQuery`/`isAdmin`
- `app/api/tenants/[id]/channel-configs/route.ts` (tarefa 8) — contrato da API

### Arquivos Dependentes

- Nenhum além dos listados

### ADRs Relacionados

- [ADR-003: Configuração de canal por tenant](adrs/adr-003.md) — UX da config por tenant e mascaramento

## Entregáveis

- [ ] Aba Canais visível para owner/admin
- [ ] Cartões Telegram e WhatsApp funcionais (salvar, recarregar, mascarar)
- [ ] Status do webhook exibido com tratamento de erro

## Testes

### Testes de Integração (checklist manual — projeto sem suite)

- [ ] Owner abre Configurações > Canais pela primeira vez → credenciais legadas aparecem migradas (flags set)
- [ ] Salvar token de bot de teste → `bot_username` aparece e status do webhook Ativo (com APP_URL válida)
- [ ] Salvar sem preencher segredos → flags permanecem configuradas (ciphertext preservado)
- [ ] Desabilitar canal → toggle reflete e resposta da API confirma
- [ ] Membro `gestor`/`operador` não vê a aba Canais
- [ ] Resposta da API inspecionada no DevTools: nenhum segredo em claro

## Critérios de Sucesso

- [ ] `npm run build` compila
- [ ] `npm run lint` sem erros
- [ ] Fluxo completo de configuração do Telegram sem recarregar a página
