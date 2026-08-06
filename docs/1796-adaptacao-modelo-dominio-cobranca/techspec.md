# Especificação Técnica: Núcleo de Cobrança Centrado no Domínio

## Resumo Executivo

A implementação será incremental e aditiva, reutilizando o modelo de tenant existente, os tipos de `lib/types.ts`, as rotas de casos e o fluxo atual de conversas/IA. A primeira entrega acrescentará o vínculo canônico entre `cases` e `financial_titles`, migrará a tela de contratos para ler títulos financeiros e centralizará a criação elegível em uma função transacional do Supabase.

O principal trade-off é manter campos opcionais para registros legados enquanto novas criações exigem contexto completo. Isso preserva histórico e continuidade operacional, mas exige que a API e a interface diferenciem registros canônicos de casos com contexto legado incompleto.

## Arquitetura do Sistema

### Visão dos Componentes

| Componente | Responsabilidade | Relação |
|---|---|---|
| `supabase_collection_case_core.sql` | Acrescentar vínculos, índices, RLS, backfill seguro e função transacional de criação | Evolui o baseline `supabase_tenant_model.sql` |
| Função transacional de criação | Validar tenant, título, vencimento e duplicidade; criar o caso completo | Chamada pela API e por futuras automações |
| `app/api/cases/route.ts` | Listar casos e criar novos casos por `financial_title_id` | Usa `requireUser()` e a função do banco |
| `app/api/cases/[id]/route.ts` | Consultar contexto, atualizar campos permitidos e preservar histórico | Retorna cliente, contrato, título, mensagens e auditoria |
| `app/api/financial-titles/route.ts` | Listar títulos canônicos por contrato | Substitui a leitura direta de parcelas na tela de contrato |
| `lib/audit.ts` | Registrar ações críticas com ator, entidade, tenant e metadados | Reutilizado pelas rotas de casos e mensagens |
| `lib/types.ts` | Expor tipos canônicos e respostas compostas | Compartilhado por APIs e componentes |
| `app/contracts/[id]/page.tsx` | Exibir títulos canônicos e iniciar caso com ID do título | Mantém a experiência atual com fonte de dados correta |
| `app/cases/[id]/page.tsx` | Exibir o contexto completo do caso e a conversa | Mantém chat, status, IA e intervenção humana |
| `lib/agent.ts` | Processar conversa com contexto do caso | Passa a usar cliente server-side/contexto carregado |
| `app/api/agent-message`, `/api/chat` e webhooks | Entradas de mensagens e automações | Reutilizam a leitura canônica e a auditoria |

Fluxo de dados:

```text
Usuário autenticado
  -> Rota Next.js
  -> requireUser() + tenant/membership
  -> RPC transacional ou consulta RLS
  -> financial_title -> contract -> client
  -> case -> messages/audit_logs
```

A aplicação não deve usar o service role para contornar RLS em rotas comuns. O fallback administrativo somente poderá atuar quando houver tenant explícito e validado no contexto da operação.

## Design de Implementação

### Interfaces Principais

Os tipos abaixo serão adicionados ou ajustados em `lib/types.ts`:

```ts
type CaseCreationErrorCode =
  | "TITLE_NOT_FOUND"
  | "TITLE_NOT_OVERDUE"
  | "TITLE_NOT_COLLECTIBLE"
  | "ACTIVE_CASE_EXISTS";

interface CreateCaseInput {
  financial_title_id: string;
}

interface CollectionCaseContext {
  case: Case;
  client: Client | null;
  contract: Contract | null;
  financial_title: FinancialTitle | null;
  legacy_context: boolean;
  messages: Message[];
  audit_logs: AuditLog[];
}
```

Contrato de resultado da função de criação:

```ts
interface CreateCaseResult {
  case: Case | null;
  error_code: CaseCreationErrorCode | null;
}
```

Convenções:

- `financial_title_id` é obrigatório para criação.
- Erros de regra de negócio usam código estável, mensagem em português e status HTTP previsível.
- `404` representa título ou caso não acessível no tenant.
- `400` representa título não elegível.
- `409` representa caso ativo duplicado.
- Erros inesperados retornam `500` sem expor detalhes internos.
- O backend deve validar corpo, IDs e campos permitidos antes de chamar o banco.

### Modelos de Dados

#### `cases`

Adicionar de forma compatível:

- `financial_title_id uuid null references financial_titles(id)`.
- `assigned_user_id uuid null references auth.users(id)`.
- `legacy_context boolean not null default false`.
- Índice em `financial_title_id`.
- Índice em `assigned_user_id`.
- Índice parcial para localizar casos ativos por título.
- Foreign key indexada para joins e operações de exclusão.
- Trigger ou função de consistência para impedir que o título pertença a outro tenant.

`financial_title_id` permanece nulo somente para casos históricos sem correspondência determinística.

#### `financial_titles`

Usar a tabela existente como fonte canônica:

- `id`.
- `tenant_id`.
- `contract_id`.
- `number`.
- `due_date`.
- `original_amount`.
- `current_amount`.
- `status`.
- `days_overdue`.

A elegibilidade do título não deve depender somente de `days_overdue` persistido. A função deve avaliar a data de vencimento e o status atual. A regra inicial será `due_date < current_date` e status diferente de pago/cancelado, sujeita à política de carência registrada em Questões em Aberto.

#### Relações

```text
tenants
  -> tenant_members
  -> clients
  -> contracts
  -> financial_titles
  -> cases
  -> messages
  -> audit_logs
```

O vínculo de cliente é obtido pelo contrato. Não adicionar `client_id` ou `contract_id` redundantes em `cases` nesta primeira entrega, salvo necessidade comprovada por consulta; o título já fornece o caminho canônico.

#### Backfill

O backfill deve:

- Executar somente após a existência dos novos campos.
- Considerar cliente/contrato, data de vencimento, valor e outros identificadores disponíveis.
- Atualizar apenas correspondências únicas e determinísticas.
- Marcar como `legacy_context = true` os casos que não puderem ser relacionados.
- Ser idempotente.
- Não substituir vínculos existentes.
- Não excluir nem reescrever mensagens e auditoria históricas.
- Produzir contagem de vinculados, incompletos e ambíguos para verificação.

#### Auditoria

Reutilizar `audit_logs` e preencher os campos existentes de entidade, ator, tenant, metadados e antes/depois. A auditoria mínima cobre:

- Criação do caso.
- Alteração de status.
- Atribuição ou troca de responsável.
- Mensagem humana e de IA.
- Encerramento.
- Resultado da criação baseada em título, sem registrar dados sensíveis desnecessários em texto livre.

### Endpoints da API

#### `GET /api/cases`

Preservar paginação, busca e filtro de status. Incluir no retorno os campos resumidos do título, contrato e cliente quando disponíveis.

Respostas:

- `200 { cases, totalPages, total, page }`.
- `401` para sessão ausente.
- `500` para falha inesperada.

#### `POST /api/cases`

Entrada:

```json
{
  "financial_title_id": "uuid"
}
```

Fluxo:

1. Executar `requireUser()`.
2. Resolver membership e tenant ativo no contexto do banco.
3. Chamar a função transacional.
4. Traduzir o código da função para resposta HTTP em português.
5. Retornar o caso completo criado.

Respostas:

- `201 { ok: true, case }`.
- `400 { error, code: "TITLE_NOT_OVERDUE" }`.
- `400 { error, code: "TITLE_NOT_COLLECTIBLE" }`.
- `404 { error, code: "TITLE_NOT_FOUND" }`.
- `409 { error, code: "ACTIVE_CASE_EXISTS" }`.
- `401` para sessão ausente.

O payload legado de nome, telefone, valor e vencimento não será aceito para novas criações.

#### `GET /api/cases/[id]`

Retornar `case`, `client`, `contract`, `financial_title`, `messages`, `audit_logs`, `stage` e `legacy_context`. A consulta deve usar RLS e filtrar o caso pelo tenant resolvido. Casos legados continuam legíveis com os campos canônicos nulos.

#### `PATCH /api/cases/[id]`

Aceitar somente uma allowlist de `status`, `assigned_user_id` e campos de encerramento permitidos. Validar transições e registrar antes/depois. Não aplicar o corpo inteiro da requisição diretamente na tabela.

#### `DELETE /api/cases/[id]`

Não excluir mensagens nem o caso em fluxo normal. A operação deve ser removida da interface ou convertida em encerramento/arquivamento conforme o status adotado no código existente. A decisão final de arquivamento permanece limitada ao necessário para preservar histórico.

#### `GET /api/financial-titles?contract_id=...`

Adicionar leitura autenticada de títulos canônicos filtrados por contrato e tenant. Retornar status, vencimento, valores e elegibilidade calculada para apresentação.

Respostas:

- `200 { financial_titles }`.
- `401` para sessão ausente.
- `404` quando o contrato não estiver disponível.
- `500` para falha inesperada.

### Banco, RLS e RPC

A migração deve ser aditiva e aplicada depois de `supabase_tenant_model.sql`. Não reutilizar políticas permissivas de migrações antigas.

A função transacional deve:

- Receber o `financial_title_id` e contexto administrativo somente quando aplicável.
- Confirmar a identidade autenticada dentro da própria função.
- Resolver a associação do usuário ao tenant.
- Permitir tenant explícito somente para super-admin validado.
- Consultar título, contrato e cliente no mesmo tenant.
- Validar vencimento e status.
- Bloquear caso ativo duplicado.
- Inserir o caso com os dados canônicos.
- Registrar o evento de criação ou retornar código estável.
- Usar locking/índice único para evitar corrida entre solicitações concorrentes.

As políticas RLS devem manter `tenant_id` como limite primário. Consultas de membership devem ser indexadas e funções usadas em políticas devem ser avaliadas de forma eficiente, sem fazer chamadas desnecessárias por linha.

### Auditoria e acesso server-side

Generalizar `lib/audit.ts` para receber `tenant_id`, `entity_type`, `entity_id`, `actor_user_id`, `action`, `metadata`, `before`, `after` e `case_id`.

A função deve verificar e propagar erros de inserção. Rotas que alteram dados devem chamar `requireUser()` antes de consultar ou mutar.

Corrigir o uso de `lib/supabase.ts` browser-only em `lib/agent.ts` e rotas server-side. O agente deve receber um cliente server-side ou o contexto carregado da operação. `/api/chat`, `/api/start-negotiation` e endpoints internos equivalentes devem ter autenticação e escopo de caso.

### Componentes Frontend

#### `app/contracts/[id]/page.tsx`

- Substituir leitura direta de `installments` por `/api/financial-titles`.
- Exibir claramente títulos vencidos e não elegíveis.
- Enviar somente `financial_title_id` ao criar o caso.
- Remover a atualização separada e não atômica da parcela.
- Exibir mensagens específicas para título não vencido, pago, cancelado ou caso duplicado.
- Preservar navegação e aparência geral da tela.

#### `app/cases/[id]/page.tsx`

Adicionar ao workspace cliente e documento, contrato e número, título e referência, valor original e atual, data de vencimento e dias em atraso, status e responsável, aviso de contexto legado incompleto e histórico de auditoria autorizado.

Preservar chat, status, IA, intervenção humana e download do dossiê.

#### Tipagem e estados

As respostas devem usar tipos compartilhados, tratar loading/erro/vazio e manter mensagens de erro em português. O estado de contexto legado não deve bloquear a leitura do caso histórico.

## Pontos de Integração

Não será adicionada nova integração externa no MVP. WhatsApp, Telegram e provedores de IA existentes continuarão operando.

As entradas de webhook que localizam casos por telefone ou chat devem carregar o contexto canônico do caso antes de gerar ou enviar mensagens. O uso de service role em webhooks deve permanecer restrito ao fluxo público necessário, com validação da associação entre identificador externo, caso e tenant.

## Análise de Impacto

| Componente | Tipo | Impacto e risco | Ação necessária |
|---|---|---|---|
| `supabase_collection_case_core.sql` | Novo | Alto; erro pode expor dados ou impedir criação | Implementar migração aditiva, RLS, função e backfill verificável |
| `lib/types.ts` | Modificado | Médio; tipos incompletos geram erros de integração | Adicionar contexto, auditoria e códigos de erro |
| `app/api/cases/route.ts` | Modificado | Alto; é o principal ponto de criação | Exigir título e chamar função transacional |
| `app/api/cases/[id]/route.ts` | Modificado | Alto; PATCH atual é amplo e DELETE perde histórico | Restringir campos, adicionar auditoria e preservar histórico |
| `app/api/financial-titles/route.ts` | Novo | Médio; nova fonte de leitura da tela | Implementar consulta tenant-safe |
| `lib/audit.ts` | Modificado | Alto; auditoria atual ignora erros | Generalizar contrato e propagar falhas |
| `app/contracts/[id]/page.tsx` | Modificado | Alto; hoje permite títulos pendentes | Usar títulos canônicos e mensagens de elegibilidade |
| `app/cases/[id]/page.tsx` | Modificado | Médio; precisa exibir contexto composto | Adicionar resumo financeiro, legado e auditoria |
| `lib/agent.ts` | Modificado | Alto; cliente browser-only em servidor | Usar cliente server-side/contexto carregado |
| `/api/chat`, `/api/start-negotiation` e webhooks | Modificado | Alto; escopo/autenticação inconsistentes | Aplicar autenticação e contexto canônico |
| Migrações SQL antigas | Não alterar | Alto; podem reabrir políticas permissivas | Usar somente o novo baseline e documentar ordem |

## Estratégia de Testes

### Testes Unitários

Como o projeto não possui suíte configurada, adicionar testes somente se a infraestrutura existente permitir sem criar uma nova plataforma ampla. Priorizar funções puras e contratos: mapeamento de códigos da RPC para status HTTP, cálculo de elegibilidade exibida na API, allowlist de campos do PATCH, conversão de status e mensagens de erro para português e serialização de `CollectionCaseContext`.

### Testes de Integração e SQL

Criar cenários executáveis no ambiente Supabase disponível ou scripts SQL de verificação para dois tenants com dados distintos, isolamento de usuário regular, super-admin com tenant explícito, título futuro, título com vencimento hoje, título vencido elegível, título pago, título cancelado, duas criações concorrentes, caso ativo duplicado, backfill determinístico, backfill ambíguo, caso legado incompleto, auditoria e preservação de mensagens.

### Verificação de API e Frontend

Verificar POST sem título, título inacessível, não vencido, elegível e duplicado; tela de contrato; caso canônico; caso legado; sessão ausente em todas as rotas alteradas. Executar `npm run lint` e `npm run build` ao final.

## Sequenciamento de Desenvolvimento

### Ordem de Build

1. **Mapear e congelar o baseline de dados e rotas** — sem dependências; confirmar tabelas, políticas, tipos, status existentes e consumidores do POST.
2. **Criar a migração aditiva e os índices** — depende do passo 1; adicionar campos opcionais, foreign keys, índices e estruturas de auditoria sem excluir histórico.
3. **Implementar backfill seguro** — depende do passo 2; vincular apenas correspondências determinísticas e marcar contexto legado incompleto.
4. **Implementar RLS, consistência de tenant e função transacional** — depende dos passos 2 e 3; centralizar elegibilidade, duplicidade e criação atômica.
5. **Atualizar tipos e contratos de erro** — depende do passo 4; refletir entidades, contexto, auditoria e códigos da função.
6. **Atualizar `POST/GET /api/cases` e criar leitura de títulos** — depende dos passos 4 e 5; tornar `financial_title_id` obrigatório e expor títulos canônicos.
7. **Hardenizar detalhe/PATCH/DELETE e auditoria** — depende dos passos 5 e 6; preservar histórico, permitir somente campos válidos e registrar alterações.
8. **Migrar a tela de contratos e o workspace do caso** — depende dos passos 6 e 7; preservar UX e exibir o contexto canônico.
9. **Corrigir acessos server-side do agente e webhooks** — depende dos passos 6 e 7; carregar contexto e autenticar rotas internas.
10. **Executar SQL/API, lint e build** — depende de todos os passos anteriores; validar segurança, regras de negócio, regressões e compilação.

### Dependências Técnicas

- O projeto Supabase deve conter o baseline `supabase_tenant_model.sql` ou equivalente aplicado.
- O ambiente de verificação precisa suportar RLS, funções transacionais e dados de dois tenants.
- A política de carência para definir “vencido” deve ser confirmada antes da produção.
- O formato dos status canônicos precisa ser compatível com os status atuais ou ter mapeamento explícito.
- Nenhum pacote novo é necessário para o escopo definido.

## Monitoramento e Observabilidade

Registrar métricas e logs estruturados para tentativas de criação por resultado, quantidade de casos canônicos/legados, falhas da função e da auditoria, alterações de status e atribuições, mensagens processadas com contexto e tempo de resposta das operações principais.

Alertar quando houver falha de auditoria, aumento da taxa de erro da função, tentativa de acesso sem tenant válido ou volume inesperado de correspondências ambíguas no backfill.

## Considerações Técnicas

### Decisões Principais

- **Validação no banco por função transacional:** garante regra única e atomicidade; abre mão de concentrar toda a lógica na API. Registrada no ADR-002.
- **Backfill seguro com estado incompleto:** preserva o histórico e evita vínculos inventados; exige suporte temporário a contexto parcial. Registrada no ADR-003.
- **Título obrigatório na criação:** elimina novos casos sem origem financeira; exige atualizar o consumidor controlado da API. Registrada no ADR-004.
- **Membership e contexto no banco:** evita confiar em tenant enviado pelo cliente; exige tratamento especial para super-admin com tenant explícito validado.

### Riscos Conhecidos

- **Políticas antigas conflitantes:** podem permitir acesso indevido ou comportamento diferente. Mitigação: aplicar somente a migração nova sobre o baseline atual e testar RLS por tenant.
- **Dados legados atribuídos incorretamente por migração anterior:** podem não permitir correção automática. Mitigação: não reatribuir sem correspondência determinística e sinalizar casos incompletos.
- **Regras de status divergentes entre SQL e TypeScript:** podem bloquear fluxos existentes. Mitigação: centralizar códigos e testar todos os status atuais.
- **Rotas com service role sem tenant explícito:** podem contornar isolamento. Mitigação: exigir autenticação, membership e contexto explícito nas exceções administrativas.
- **Falha do agente em runtime server-side:** o cliente browser-only atual pode quebrar mensagens. Mitigação: passar cliente server-side/contexto e validar com rotas de chat e webhooks.

## Registros de Decisão de Arquitetura

- [ADR-001: Preservar a Experiência Atual de Cobrança com um Núcleo de Domínio Mais Forte](adrs/adr-001.md) — Consolidar o domínio principal preservando experiência e histórico.
- [ADR-002: Centralizar a Criação Elegível de Casos em uma Função Transacional do Banco](adrs/adr-002.md) — Unificar validação de tenant, vencimento e duplicidade no banco.
- [ADR-003: Fazer Backfill Seguro e Sinalizar Contexto Legado Incompleto](adrs/adr-003.md) — Recuperar somente vínculos determinísticos e preservar os demais.
- [ADR-004: Tornar o Título Financeiro Obrigatório na Criação de Novos Casos](adrs/adr-004.md) — Exigir origem financeira explícita no contrato de criação.
