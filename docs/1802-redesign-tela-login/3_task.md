---
status: pending
title: Validar responsividade, lint, typecheck e build
type: frontend
complexity: low
dependencies:
  - 1_task
  - 2_task
---

# Validar responsividade, lint, typecheck e build

## Visão Geral

Executa a verificação final do redesign da tela de login: garante que a responsividade está correta (duas colunas no desktop, uma no mobile), que a tipagem e o lint estão limpos e que o build de produção passa. Confirma também que não houve regressão no fluxo de autenticação.

<critical>
- Leia o PRD e a TechSpec antes de validar.
- A feature está em `app/login/page.tsx`; não altere o código nesta tarefa — apenas valide e reporte.
- Verificação via tooling e checagem manual (não há suite de testes no projeto).
- Não faça commit/push — deixe o diff pronto.
</critical>

<requirements>
- DEVE rodar `npx tsc --noEmit` sem erros.
- DEVE rodar `npm run lint` sem erros.
- DEVE rodar `npm run build` com sucesso (roda typecheck, não lint).
- DEVE verificar manualmente o colapso responsivo (< `lg`) sem perda de elementos essenciais do form.
- DEVE verificar manualmente que o fluxo de auth não regressou (login válido/inválido, redirect, banner de erro, toggle de senha).
- O diff DEVE ser deixado pronto para revisão, sem commit automático.

## Subtasks
- [ ] 3.1 Rodar `npx tsc --noEmit` e resolver/relatar qualquer erro de tipo.
- [ ] 3.2 Rodar `npm run lint` e corrigir/relatar avisos.
- [ ] 3.3 Rodar `npm run build` e verificar sucesso.
- [ ] 3.4 Checar responsividade manualmente (desktop 2 colunas; mobile 1 coluna).
- [ ] 3.5 Verificar fluxo de auth manualmente (login ok, erro, já autenticado, toggle).
- [ ] 3.6 Confirmar que o diff está pronto, sem novos arquivos/dependências desnecessários.

## Detalhes de Implementação
- Nenhum arquivo a modificar — validação da feature produzida nas tarefas 1 e 2.
- Comandos: `npx tsc --noEmit`, `npm run lint`, `npm run build` (ver AGENTS.md).
- Foco: revisar `app/login/page.tsx` para garantir aderência ao ADR-004 (single-file) e à TechSpec.

### Arquivos Relevantes
- `app/login/page.tsx` — a feature validada.
- `package.json` — scripts de validação.

### Arquivos Dependentes
- Nenhum.

### ADRs Relacionados
- [ADR-004: Implementação single-file](adrs/adr-004.md) — garante que a feature segue o escopo single-file.

## Entregáveis
- Resultado de `npx tsc --noEmit` sem erros **(REQUERIDO)**.
- Resultado de `npm run lint` sem erros **(REQUERIDO)**.
- Resultado de `npm run build` com sucesso **(REQUERIDO)**.
- Evidência de verificação manual de responsividade e auth.
- Diff pronto para revisão, sem commit.

## Testes
- **Unitários** (tooling):
  - [ ] `npx tsc --noEmit` não reporta erros.
  - [ ] `npm run lint` não reporta problemas.
- **Integração (manuais)**:
  - [ ] Em desktop a tela mostra coluna de branding + coluna de form.
  - [ ] Em viewport < `lg` a interface empilha em uma coluna sem perder o form.
  - [ ] Login válido redireciona para `/`.
  - [ ] Login inválido mostra banner de erro.
  - [ ] Toggle de senha mostra/oculta o texto.
  - [ ] "Esqueci minha senha" não navega.
- Target de cobertura: não aplicável (sem suite; validação manual + tooling).

## Critérios de Sucesso
- tsc, lint e build passam.
- Responsividade e fluxo de auth verificados manualmente sem regressão.
- Diff pronto para commit manual.