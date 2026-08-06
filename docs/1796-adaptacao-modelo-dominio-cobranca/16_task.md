---
status: completed
title: Executar verificação integrada e preparar rollout
type: supabase
complexity: medium
dependencies: ["1_task", "2_task", "3_task", "4_task", "5_task", "6_task", "7_task", "8_task", "9_task", "10_task", "11_task", "12_task", "13_task", "14_task", "15_task"]
---

# Executar verificação integrada e preparar rollout

## Visão Geral

Consolidar a verificação de segurança, banco, API e interface antes da entrega. A tarefa também documenta a ordem de aplicação da migração e confirma que o rollout preserva histórico e não mistura tenants.

<critical>
- Leia PRD, TechSpec e todos os ADRs.
- Não aplicar migração remota sem confirmar o baseline real.
- Não fazer commit ou push automaticamente.
- A evidência deve ser fresca: execute os comandos nesta tarefa.
</critical>

<requirements>
1. A verificação DEVE cobrir dois tenants e um super-admin escopado.
2. A verificação DEVE cobrir títulos futuros, hoje, vencidos, pagos e cancelados.
3. A verificação DEVE cobrir duplicidade concorrente e backfill.
4. O rollout DEVE registrar ordem de SQL e plano de reversão operacional.
5. `npm run lint` e `npm run build` DEVEM ser executados após todas as alterações.
</requirements>

## Subtarefas

- [x] Criar verificador SQL não destrutivo.
- [x] Executar cenários de RLS e RPC.
- [x] Validar endpoints e telas principais.
- [x] Executar lint, TypeScript e build.
- [x] Registrar evidências e pendências.

## Detalhes de Implementação

### Arquivos a Criar

- `supabase_collection_case_core_verify.sql` — verificações SQL não destrutivas.

### Arquivos a Modificar

- `docs/1796-adaptacao-modelo-dominio-cobranca/baseline.md` — ordem e evidências finais.

### Arquivos Relevantes

- `supabase_collection_case_core.sql` — migração.
- `package.json` — comandos oficiais.
- PRD, TechSpec e ADRs — critérios de aceite.

### Arquivos Dependentes

- Nenhuma tarefa posterior; é o gate de entrega.

## Entregáveis

- [x] Verificador SQL.
- [x] Evidência de RLS e regras de negócio.
- [x] Evidência de API e frontend.
- [x] Registro de lint, TypeScript e build.
- [x] Diff pronto sem commit/push.

## Testes

### Testes Unitários

- [x] Executar `npx tsc --noEmit`.
- [x] Executar `npm run lint`.

### Testes de Integração

- [x] Dois tenants permanecem isolados.
- [x] Super-admin com tenant explícito permanece escopado.
- [x] Somente título vencido elegível cria caso.
- [x] Caso ativo duplicado é rejeitado.
- [x] Backfill ambíguo permanece incompleto.
- [x] Mensagens e auditoria são preservadas.
- [x] Executar `npm run build`.

## Critérios de Sucesso

- [x] Verificador SQL executado sem violações.
- [x] Endpoints e telas principais validados.
- [x] `npx tsc --noEmit` sem erros.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
- [x] Nenhum commit ou push automático realizado.
