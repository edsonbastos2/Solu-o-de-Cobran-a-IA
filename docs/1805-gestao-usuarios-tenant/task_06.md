---
status: done
title: "Interface de gestão de equipe: aba Equipe em Configurações"
type: frontend
complexity: alta
dependencies:
  - task_03
  - task_05
---

# Tarefa 06: Interface de gestão de equipe — aba "Equipe" em Configurações

## Visão Geral

Adiciona a superfície voltada ao usuário para tudo o que a task_05 construiu: uma nova aba "Equipe" em `app/(dashboard)/settings/page.tsx`, ao lado das abas existentes Perfil/Modelos de IA/Configurações do Tenant, renderizando uma lista de membros com ações de convidar/editar/reenviar/revogar/remover. Apenas `owner`/`admin` devem ver esta aba, correspondendo a quem as rotas da task_05 realmente autorizam.

<critical>
- SEMPRE LEIA o PRD e a TechSpec antes de começar (`../prd.md`, `../techspec.md`).
- REFERENCIE a seção 'Experiência do Usuário' da TechSpec (via o PRD) para os fluxos exatos (convidar, alterar acesso, casos de borda) — não invente uma UX diferente da que foi aprovada.
- FOQUE NO "O QUÊ" — o comportamento e os estados da tela, não a estilização Tailwind classe por classe (siga os padrões existentes).
- MINIMIZE CÓDIGO — reutilize o padrão existente de troca de abas e componente de painel de `settings/page.tsx` e `components/tenant-ai-config-panel.tsx`.
- TESTES OBRIGATÓRIOS — verificação manual de todo fluxo e caso de borda da seção Experiência do Usuário do PRD.
</critical>

<requirements>
- DEVE adicionar `'team'` à união `activeTab` de `SettingsPage` (atualmente `'profile' | 'ai' | 'tenant'`) e um botão de aba correspondente na sidebar, seguindo exatamente o padrão visual dos três botões existentes (ícone + rótulo, classes Tailwind de ativo/inativo já estabelecidas no arquivo).
- DEVE renderizar a nova aba apenas quando `useAuth().role` for `'owner'` ou `'admin'` (o valor `role` da task_03) — `gestor`/`operador` não devem ver o botão da aba "Equipe" de forma alguma, consistente com apenas owner/admin sendo autorizados pelas rotas da task_05.
- DEVE criar `components/team-management-panel.tsx`, renderizado quando `activeTab === 'team'`, seguindo o mesmo padrão de "componente de painel autocontido que busca seus próprios dados via `fetchWithAuth`" de `components/tenant-ai-config-panel.tsx`.
- DEVE mostrar, por membro: nome/e-mail, papel (com uma descrição de uma linha em linguagem simples do que cada papel pode fazer, mostrada inline no momento do convite/edição — não apenas o nome do papel, conforme o requisito de UX do PRD para evitar que "Gestor vs Operador" seja indistinguível para quem concede o acesso), o estado do interruptor de configuração de IA e o status (`Ativo` / `Convite pendente`).
- DEVE implementar o fluxo de convite: um modal/formulário para informar e-mail, escolher um de `admin`/`gestor`/`operador` (descrições dos papéis visíveis) e opcionalmente ativar "Pode configurar provedores de IA"; chama `POST /api/tenants/[id]/members/invite`; em sucesso, a nova linha aparece com o status `Convite pendente`.
- DEVE implementar a edição do papel e do interruptor de configuração de IA de um membro existente via `PATCH /api/tenants/[id]/members/[memberId]`, e a remoção de um membro via `DELETE`, com uma etapa de confirmação antes da remoção (ação destrutiva).
- DEVE implementar reenviar/revogar para convites `pending` (`POST .../resend`, `DELETE`), exibidos apenas para linhas com o status `Convite pendente`.
- DEVE desabilitar/ocultar os controles de editar papel e remover para a linha que representa o `owner` (a API já responde 403 nisto, mas a interface não deve oferecer uma ação que sempre falhará — conforme o caso de borda do PRD: ações bloqueadas nunca devem parecer uma ação disponível que silenciosamente não faz nada).
- DEVE mostrar uma mensagem de erro clara e específica quando um convite falhar porque o e-mail já está registrado (409) ou porque a entrega de e-mail não está configurada (conforme as respostas de erro diferenciadas da task_05) — não um "algo deu errado" genérico.
- DEVE usar `fetchWithAuth` de `lib/api.ts` para toda chamada aos endpoints da task_05, seguindo o padrão SWR/fetch existente usado em outro lugar (`components/tenant-ai-config-panel.tsx`, `loadProfile` de `settings/page.tsx`).
</requirements>

## Subtarefas
- [x] 06.1 Adicionar a aba `'team'` ao estado/sidebar de `SettingsPage`, protegida por `role in ('owner','admin')`.
- [x] 06.2 Construir `components/team-management-panel.tsx`: buscar e renderizar a lista de membros (ativos + pendentes) com descrições dos papéis.
- [x] 06.3 Construir o modal/formulário de convite (e-mail, select de papel com descrições, interruptor de configuração de IA) conectado ao `POST /invite`.
- [x] 06.4 Construir o controle de editar membro (papel + interruptor de configuração de IA) conectado ao `PATCH`, com os controles da linha do owner desabilitados/ocultos.
- [x] 06.5 Construir os controles de reenviar/revogar para linhas pendentes e o fluxo de remover-com-confirmação para linhas ativas.
- [x] 06.6 Conectar estados de erro específicos (e-mail já registrado, entrega de e-mail indisponível, falha genérica) a mensagens distintas voltadas ao usuário.

**Nota de status**: `components/team-management-panel.tsx` (novo) e `app/(dashboard)/settings/page.tsx` (aba "Equipe" adicionada, protegida por `role==='owner'||'admin'`) implementados. `npx tsc --noEmit` e `npm run lint` limpos (0 erros novos). Verificado em navegador real (`npm run dev` + Chromium via Playwright, instalado ad-hoc neste ambiente) contra o projeto Supabase configurado em `.env`: confirmado que a migração da task_01 (coluna `tenant_members.can_configure_ai`) ainda não está aplicada nesse projeto remoto — tanto a query client-side de `hooks/useAuth.ts` quanto `requireTenantContext`/`requireRole` no servidor selecionam essa coluna e por isso falham (400 / 404 `"Tenant ativo não encontrado."`) para QUALQUER usuário, não só para papéis sem permissão. Isso bloqueia a verificação fim-a-fim contra o backend real (login real funciona; resolução de papel e listagem de membros não). Para isolar e verificar apenas o código desta tarefa, a chamada REST `tenant_members` do `useAuth` e as rotas `app/api/tenants/[id]/members*` foram mockadas via interceptação de rede do Playwright — com isso, confirmado visualmente: aba "Equipe" visível para `owner`/`admin` e ausente para `gestor`/`operador`; listagem mostra nome/e-mail/papel+descrição de uma linha/toggle de IA/status; modal de convite com descrições de papel inline que mudam ao trocar o select; edição inline de papel/toggle persiste (via mock de `PATCH`); reenvio mostra confirmação sem duplicar linha; remoção de membro ativo exige confirmação prévia (rótulo "Remover"); revogação de convite pendente usa rótulo distinto ("Revogar"); linha do `owner` não renderiza nenhum controle de editar/remover; erros 409 e 502 do convite aparecem com o texto específico devolvido pela API, não um erro genérico. Também verificado sem mock, com um owner real autenticado: a aba aparece e o painel exibe corretamente o erro real da API (`"Tenant ativo não encontrado."`, 404) em vez de falhar silenciosamente — evidência de que o tratamento de erro é fiel ao contrato da API mesmo no estado pré-migração. Testado em 1440px e 390px (mobile); durante a verificação a coluna de Ações ficava fora da área visível mesmo em desktop, porque o layout de abas de Configurações (sidebar 3/12 + `max-w-5xl`) deixa a coluna de conteúdo mais estreita (~660-710px) do que o `min-w` original da tabela — corrigido reduzindo o `min-w`, truncando a descrição do papel para uma linha na lista (mantendo a descrição completa no convite/edição, conforme requisito do ADR-001) e trocando os botões de ação para ícone com `title`/`aria-label`, no mesmo padrão já usado em `components/clients/client-actions.tsx`. Duas contas de teste (`task06-owner@example.com`, `task06-operador@example.com`) foram criadas via Admin API para a verificação; suas linhas de `tenant_members`/`profiles` foram removidas ao final, mas a exclusão de `auth.users` retornou 500 (`AuthRetryableFetchError`) por um motivo não relacionado a este componente — as duas contas ficaram órfãs (sem tenant/perfil) no projeto Supabase remoto e devem ser removidas manualmente pelo dono do projeto se desejado.

## Detalhes de Implementação

`app/(dashboard)/settings/page.tsx` atualmente (linhas 11-13, 147-172, 183-185):
```typescript
const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'tenant'>('profile');
// ... três elementos <button> na sidebar, cada um alternando activeTab e aplicando
// o par de className ativo/inativo mostrado no arquivo ...
{activeTab === 'tenant' ? (<TenantAiConfigPanel />) : (<form>...</form>)}
```
Estenda a união para incluir `'team'`, adicione um quarto botão na sidebar (reutilize `useAuth()` — já importado — para renderizá-lo condicionalmente) e estenda a renderização condicional para `activeTab === 'team' ? <TeamManagementPanel /> : activeTab === 'tenant' ? <TenantAiConfigPanel /> : (<form>...</form>)`.

`components/tenant-ai-config-panel.tsx` é o modelo estrutural para `team-management-panel.tsx`: um componente autocontido `'use client'` que carrega seus próprios dados na montagem via `fetchWithAuth`, administra seu próprio estado de carregamento/erro/salvamento e renderiza seus próprios botões de salvar/ação — não passe o estado dele pelo `SettingsPage`.

### Arquivos Relevantes
- `app/(dashboard)/settings/page.tsx` — arquivo completo já revisado; o estado de troca de abas (linha 13), os botões da sidebar (linhas 147-172) e o condicional de conteúdo da aba (linha 183) são os pontos exatos de edição.
- `components/tenant-ai-config-panel.tsx` — padrão estrutural a espelhar no novo componente de painel (ainda não lido por completo para esta tarefa — leia-o antes de implementar para corresponder às convenções exatas de carregamento de dados/estado de erro).
- `hooks/useAuth.ts` (task_03) — fonte de `role`/`canConfigureAI` para proteger a aba e os controles da linha do owner.
- `lib/api.ts` — `fetchWithAuth` (wrapper de fetch com anexação de Bearer token já usado em todo o projeto).

### Arquivos Dependentes
- `app/api/tenants/[id]/members/*` (task_05) — os cinco endpoints que este painel chama; a UX desta tarefa (mensagens de erro, rótulos de status) deve corresponder exatamente ao que essas rotas retornam.

### ADRs Relacionados
- [ADR-001: Papéis fixos de equipe com um interruptor independente de permissão de configuração de IA](adrs/adr-001.md) — Base para o requisito de descrição-de-papel-inline (evitando o modo de falha de "nome de papel opaco" destacado na pesquisa de mercado do PRD).

## Entregáveis
- `components/team-management-panel.tsx` implementando listar/convidar/editar/reenviar/revogar/remover.
- `app/(dashboard)/settings/page.tsx` atualizado com a nova aba, protegida por papel.
- `npx tsc --noEmit` e `npm run lint` passam.
- Verificação manual no navegador de todo fluxo abaixo (conforme o CLAUDE.md: mudanças de UI devem ser exercitadas em um servidor dev em execução antes de serem reportadas como concluídas).

## Testes
- Manual, em uma sessão `npm run dev` em execução (conforme convenção do projeto — sem suíte de testes de frontend automatizada). Como a migração da task_01 não está aplicada no Supabase remoto deste ambiente, os itens abaixo marcados "via mock" foram verificados isolando o componente desta tarefa com interceptação de rede (Playwright `page.route`) simulando o schema pós-migração, não contra o backend real; os demais foram verificados sem mock, contra login/API reais:
  - [x] Como `owner`: a aba "Equipe" está visível; convidar um `gestor` tem sucesso e a linha aparece como `Convite pendente`. (via mock — a resolução de papel e `POST /invite` reais estão bloqueadas pela coluna ausente; comportamento do componente confirmado com resposta simulada)
  - [x] Como `gestor`/`operador`: a aba "Equipe" não aparece na sidebar de forma alguma. (via mock, e também confirmado indiretamente sem mock: com a query real quebrada, `role` fica `null` para todo usuário e a aba também some — condição mais restritiva que o caso `gestor`/`operador`, então não isola o `role==='owner'||'admin'` sozinho; a verificação decisiva foi a via mock, testada para os 4 papéis)
  - [x] Convidar um e-mail já registrado evidencia a mensagem específica de 409, não um erro genérico. (via mock)
  - [x] Editar o interruptor de configuração de IA de um `operador` existente e confirmar que persiste (re-busca mostra o novo estado). (via mock — `PATCH` simulado, `loadMembers()` reexecuta e reflete o novo valor)
  - [x] A linha do `owner` não tem controle de editar papel ou remover renderizado (ou está visivelmente desabilitado), mesmo que o usuário atual seja `admin`. (via mock)
  - [x] Remover um convite `pending` funciona via uma ação distinta de "revogar"; remover um membro `active` exige uma etapa de confirmação primeiro. (via mock)
  - [x] Reenviar um convite `pending` mostra uma confirmação de sucesso sem duplicar a linha. (via mock)
  - [x] As descrições dos papéis estão visíveis inline tanto no formulário de convite quanto no controle de edição, não apenas o nome do papel. (sem mock — renderização client-side, não depende do backend)
  - [x] Estado de erro real (sem mock): com um `owner` de verdade autenticado contra o Supabase remoto configurado, o painel exibe o erro genuíno da API (`"Tenant ativo não encontrado."`, 404) em vez de falhar silenciosamente, confirmando que o tratamento de erro é fiel ao contrato real da API.
- Alvo de cobertura de teste: todo fluxo da lista de Requisitos exercitado pelo menos uma vez no navegador (via mock onde o backend real está bloqueado pela migração pendente da task_01).

## Critérios de Sucesso
- Todos os fluxos do checklist de Testes verificados em um servidor dev em execução, não apenas na checagem de tipos.
- Visibilidade da aba corretamente protegida por papel.
- `npx tsc --noEmit` e `npm run lint` limpos.