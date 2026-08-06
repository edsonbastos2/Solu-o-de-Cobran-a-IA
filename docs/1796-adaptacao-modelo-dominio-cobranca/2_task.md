---
status: completed
title: Criar resolução segura de tenant no servidor
type: backend
complexity: medium
dependencies: ["1_task"]
---

# Criar resolução segura de tenant no servidor

## Visão Geral

Criar uma resolução server-side de membership e tenant ativo para as rotas do núcleo de cobrança. Usuários regulares devem operar no tenant associado; super-admins só podem usar um tenant explícito e validado.

<critical>
- Leia PRD, TechSpec e ADR-001.
- Preserve RLS como limite de segurança.
- Não aceite tenant não validado vindo do cliente.
- Testes são obrigatórios.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. O servidor DEVE resolver membership usando o usuário autenticado.
2. Usuário de outro tenant DEVE receber acesso negado ou recurso inexistente.
3. Super-admin DEVE informar tenant explícito em operações escopadas.
4. A resolução DEVE ser reutilizável pelas rotas de casos e títulos.
</requirements>

## Subtarefas

- [x] Definir tipo de contexto de tenant.
- [x] Implementar resolução server-side.
- [x] Integrar autenticação e membership.
- [x] Cobrir usuário regular e super-admin.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum; reutilizar módulos existentes.

### Arquivos a Modificar

- `lib/api-auth.ts` — expor contexto validado.
- `lib/tenant.ts` — compartilhar resolução necessária.
- `lib/supabase-server.ts` — suportar contexto server-side.

### Arquivos Relevantes

- `middleware.ts` — proteção inicial de rotas.
- `supabase_tenant_model.sql` — funções de membership/RLS.

### Arquivos Dependentes

- `5_task.md`, `7_task.md`, `8_task.md` e `10_task.md`.

### ADRs Relacionados

- [ADR-002](adrs/adr-002.md) — exige validação de tenant na operação transacional.

## Entregáveis

- [x] Contexto server-side de tenant.
- [x] Tratamento de super-admin escopado.
- [x] Testes de isolamento.

## Testes

### Testes Unitários

- [x] Sessão ausente retorna erro de autenticação.
- [x] Tenant ausente para operação escopada retorna erro claro.

### Testes de Integração

- [x] Usuário do tenant A não acessa dados do tenant B.
- [x] Super-admin sem tenant explícito é rejeitado.
- [x] Super-admin com tenant válido acessa somente o tenant selecionado.

## Critérios de Sucesso

- [x] Nenhuma rota precisa confiar em tenant enviado sem validação.
- [x] Testes de isolamento passam.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
