---
description: Executa uma tarefa de ponta a ponta (feature, alteração ou bug) via fluxo agêntico
argument-hint: <descrição da tarefa ou caminho da especificação>
---

Você é o **maestro** de um fluxo agêntico de ponta a ponta neste projeto
(Next.js 15 App Router, React 19, TypeScript 5.7, Tailwind CSS 4.1, Supabase).

## Tarefa

```
$ARGUMENTS
```

## O que fazer

### Fase 0 — Spec (você conduz no fluxo principal; é interativa)

As skills `cy-create-prd`, `cy-create-techspec` e `cy-create-tasks` são **interativas**
(perguntam ao usuário uma de cada vez, com `HARD-GATE` de aprovação). Subagentes **não**
conseguem fazer perguntas que pausam para o usuário — então a fase de spec roda **no fluxo
principal (você)**, nunca delegada a um subagente. Antes de delegar qualquer implementação:

1. **Derive o `<ticket>-<slug>`** da feature (ticket a partir do prefixo numérico da branch
   git atual, ex.: branch `1796-feature-x` → ticket `1796`; se a branch não tiver prefixo
   numérico, pergunte o ticket ao usuário) e procure artefatos de spec em
   `./docs/<ticket>-<slug>/` (caminho relativo à raiz do projeto):
   `prd.md`, `techspec.md`, `tasks.md`. Procure também um PRD avulso em `./docs/`
   (ex.: `./docs/PRD-*.md`).
2. **Importe um PRD avulso**: se existir um PRD avulso em `./docs/` e não houver
   `./docs/<ticket>-<slug>/prd.md`, copie-o para
   `./docs/<ticket>-<slug>/prd.md` antes de continuar (crie o diretório
   se preciso).
3. **Continue a cadeia a partir do primeiro artefato faltante**, invocando a skill
   correspondente via tool `Skill` no fluxo principal. **Não recrie** um artefato que já
   existe:
   - falta `prd.md` → `cy-create-prd`
   - tem `prd.md`, falta `techspec.md` → `cy-create-techspec`
   - tem `techspec.md`, falta `tasks.md` → `cy-create-tasks`
   - já há `tasks.md` → pule direto para a Fase 1

### Fase 1 — Implementação (você delega aos subagentes)

1. **Invoque a skill `feature-orchestrator`** (tool `Skill`) passando a tarefa acima e o
   caminho dos artefatos de spec já produzidos na Fase 0. É essa skill que carrega a ordem
   de execução, a detecção automática de modo (Modo 1 = implementação do zero, Modo 2 =
   alteração, Modo 3 = correção de bug) e os portões `APPROVED/REJECTED`. Como a spec já
   foi feita na Fase 0, o orchestrator **não** repete a etapa de spec.

2. **Você roda no fluxo principal** — só você tem o tool `Agent`. Portanto é você quem
   delega cada etapa aos agentes especializados via `Agent` (`subagent_type`):
   `cy-frontend-developer`, `cy-component-specialist`, `cy-qa-engineer`,
   `cy-code-reviewer`, `cy-tech-lead`, `cy-bug-investigator`.
   Nunca peça a um subagente que orquestre outro — subagentes não têm o tool `Agent`.

3. **Respeite os portões.** Só avance de etapa com o veredicto positivo do agente-portão.
   Em `REJECTED`/`RETURN_TO_DEVELOPER`, devolva ao `cy-frontend-developer` e re-revise,
   com teto de 3 voltas (depois disso, `REQUER_REVISÃO_HUMANA` e pare).

4. **Fechamento.** Após o `APPROVED` do `cy-tech-lead`, rode `npm run lint && npm run build`
   como evidência fresca e deixe o diff pronto. **Não faça commit nem push automaticamente**
   — os hooks de `.claude/settings.json` já barram commit/push com verificações falhando e
   rodam o code review; o commit final é manual.
