---
name: feature-orchestrator
description: >
  Use como ponto de entrada para tarefas de implementação ou alteração de feature
  no projeto quando NÃO existe um arquivo N_task.md de um PRD formal.
  Para tarefas formais com PRD, use cy-execute-task.

  Ative esta skill quando o usuário:
  - Descrever uma nova feature para implementar ("implementa...", "cria a tela de...", "adiciona...")
  - Compartilhar uma especificação de negócio ou ticket para desenvolver
  - Pedir para alterar algo existente ("altera...", "ajusta...", "muda o comportamento de...")
  - Iniciar qualquer desenvolvimento que envolva mais de um arquivo
  - Perguntar "por onde começo?" ou "qual a ordem de implementação?"

  Esta skill NÃO escreve código diretamente — ela orquestra a ordem correta de execução
  e delega para os AGENTES especializados (cy-product-analyst, cy-frontend-developer,
  cy-component-specialist, cy-qa-engineer, cy-code-reviewer, cy-tech-lead, cy-bug-investigator),
  que por sua vez acionam suas skills no momento certo.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Feature Orchestrator

Orquestra a ordem correta de implementação ou alteração de features no projeto Next.js/React,
delegando para os **agentes** especializados em cada etapa e verificando a conclusão antes de avançar.

---

## Modelo de delegação em 3 camadas

Esta skill é o **maestro**. Ela não escreve código nem aplica padrões diretamente —
ela aciona o **agente** certo em cada etapa, e o agente aciona a **skill** que carrega
os padrões do projeto.

```
feature-orchestrator   →   AGENTE (papel)            →   SKILL (padrões)
  (maestro / ordem)        cy-frontend-developer          frontend-dev
                           cy-qa-engineer                 test-generator
                           ...                            ...
```

Regra: **nunca pular a camada de agente**. Toda etapa é delegada via tool `Agent` ao
agente correspondente, e é o agente quem invoca a skill. Cada agente que
emite veredicto (`APPROVED`/`REJECTED`) funciona como **portão**: só avance para a
próxima etapa com o veredicto positivo.

### Mapa agente → skill por etapa

| Etapa | Agente | Skill que o agente aciona |
|---|---|---|
| Especificação (PRD/TechSpec/Tasks) | **fluxo principal** | `cy-create-prd` / `cy-create-techspec` / `cy-create-tasks` |
| Types / Hooks / Componente | `cy-frontend-developer` | `frontend-dev` (+ `api-integration` se houver API; + `table-generator` se listagem tabular) |
| Revisão de componentização | `cy-component-specialist` | `frontend-dev` |
| Validação | `cy-qa-engineer` | `test-generator` |
| Code review | `cy-code-reviewer` | `code-review` |
| Decisão final | `cy-tech-lead` | `cy-final-verify` |
| Investigação de bug | `cy-bug-investigator` | `bug-investigator` |

---

## Passo 0 — Descobrir e ler a especificação

A fase de spec (PRD → TechSpec → Tasks) é **interativa** e roda no **fluxo principal**
(via comando `/tarefa`), nunca em subagente. Quando esta skill é invocada, a spec
**normalmente já foi produzida**.

1. Derive o `<ticket>-<slug>` da feature e procure artefatos em `./docs/<ticket>-<slug>/`:
   `prd.md`, `techspec.md`, `tasks.md`. Procure também um PRD avulso em `./docs/`.
2. Roteie pelo **estado do pipeline de spec**:
   - **Há `tasks.md`** → leia as tarefas e siga para o modo de implementação.
   - **Há `prd.md`/`techspec.md` mas falta `tasks.md`** → devolva ao fluxo principal (`/tarefa`).
   - **Não há nenhum artefato de spec** → devolva ao fluxo principal para rodar `cy-create-prd`.

---

## Modo 1 — Implementação do zero

```
ETAPA 0 → Especificação        (fluxo principal /tarefa)
ETAPA 1 → Types (lib/)         (cy-frontend-developer)
ETAPA 2 → Hooks/SWR            (cy-frontend-developer)
ETAPA 3 → Componente React     (cy-frontend-developer)
ETAPA 4 → Componentização      (cy-component-specialist) ── portão
ETAPA 5 → Validação            (cy-qa-engineer)          ── portão
ETAPA 6 → Code Review          (cy-code-reviewer)        ── portão
ETAPA 7 → Decisão final        (cy-tech-lead)            ── portão
```

### Etapa 1 — Types
- Agente: `cy-frontend-developer` → skill `api-integration`
- Criar tipos em `lib/` (ex.: `lib/NomeDTO.ts` ou estender `lib/types.ts`)
- ✅ Verificar: interface cobre todos os campos? Tipos auxiliares omitem campos do servidor?

### Etapa 2 — Hooks/SWR
- Agente: `cy-frontend-developer` → skill `frontend-dev`
- Criar `hooks/useNome.ts` — custom hook com SWR + `fetchWithAuth`
- ✅ Verificar: loading/error states? SWR cache revalidado após mutations?

### Etapa 3 — Componente React
- Agente: `cy-frontend-developer` → skills `frontend-dev` + `api-integration`
- Criar `components/NomeComponente.tsx` (React functional component)
- Se for listagem tabular, usar skill `table-generator`
- Aplicar responsividade mobile-first com Tailwind CSS
- Adicionar `data-testid` em elementos interativos
- ✅ Verificar: sem lógica de negócio no componente? Props tipadas?

### Etapa 4 — Componentização (portão)
- Agente: `cy-component-specialist`
- Revisar responsabilidade única, reutilização, props, hooks
- ✅ Portão: `APPROVED`? Se `REJECTED`, devolver à Etapa 2–3.

### Etapa 5 — Validação (portão)
- Agente: `cy-qa-engineer`
- Executar `npm run lint && npm run build` como validação mínima
- ✅ Portão: compilação sem erros? ESLint sem erros? `APPROVED`?

### Etapa 6 — Code Review (portão)
- Agente: `cy-code-reviewer`
- ✅ Portão: nenhum blocker? `APPROVED`?

### Etapa 7 — Decisão final (portão)
- Agente: `cy-tech-lead`
- Validar requisitos, evidência fresca de `npm run lint && npm run build`
- ✅ Portão: `APPROVED` ou `RETURN_TO_DEVELOPER`

---

## Modo 2 — Alteração de feature existente

```
ETAPA 1 → Mapear impacto        (orchestrator)
ETAPA 2 → Alterar Types         (cy-frontend-developer)
ETAPA 3 → Alterar Hooks         (cy-frontend-developer)
ETAPA 4 → Alterar Componente    (cy-frontend-developer)
ETAPA 5 → Componentização       (cy-component-specialist) ── portão
ETAPA 6 → Validação             (cy-qa-engineer)          ── portão
ETAPA 7 → Code Review           (cy-code-reviewer)        ── portão
ETAPA 8 → Decisão final         (cy-tech-lead)            ── portão
```

### Etapa 1 — Mapear impacto
```
Arquivos impactados:
- lib/NomeDTO.ts (ou lib/types.ts) → [ ] sim  [ ] não
- hooks/useNome.ts                 → [ ] sim  [ ] não
- components/NomeComponente.tsx    → [ ] sim  [ ] não
- testes relacionados              → [ ] sim  [ ] não
```

---

## Modo 3 — Correção de bug

```
ETAPA 1 → Investigar causa raiz  (cy-bug-investigator)
ETAPA 2 → Corrigir código        (cy-frontend-developer)
ETAPA 3 → Validar                (cy-qa-engineer)      ── portão
ETAPA 4 → Code Review            (cy-code-reviewer)    ── portão
ETAPA 5 → Decisão final          (cy-tech-lead)        ── portão
```

---

## Fechamento

1. Rodar `npm run lint && npm run build` como evidência fresca
2. Deixar o diff pronto para revisão e commit manual
3. **Não faça commit nem push automaticamente**

## Loop de portões

Teto de **3 voltas** completas. Após 3 devoluções sem aprovação → `REQUER_REVISÃO_HUMANA`.

---

## Checklist de saída

- [ ] Todos os arquivos previstos foram criados/alterados
- [ ] TypeScript compila sem erros (`npm run build`)
- [ ] ESLint passa sem erros (`npm run lint`)
- [ ] `cy-component-specialist` aprovou
- [ ] `cy-qa-engineer` aprovou
- [ ] `cy-code-reviewer` aprovou
- [ ] `cy-tech-lead` emitiu `APPROVED`
- [ ] Responsividade aplicada (Tailwind CSS mobile-first)
- [ ] Nenhuma lógica de negócio vazou para o componente
