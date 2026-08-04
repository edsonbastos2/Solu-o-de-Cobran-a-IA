---
name: feature-orchestrator
description: >
  Use como ponto de entrada para tarefas de implementação ou alteração de feature
  no projeto frontend quando NÃO existe um arquivo N_task.md de um PRD formal.
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
  que por sua vez acionam suas skills (frontend-dev, api-integration, test-generator,
  code-review, bug-investigator) no momento certo.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Feature Orchestrator

Orquestra a ordem correta de implementação ou alteração de features no projeto frontend,
delegando para os **agentes** especializados em cada etapa e verificando a conclusão antes
de avançar.

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
agente correspondente (`subagent_type`), e é o agente quem invoca a skill. Cada agente que
emite veredicto (`APPROVED`/`REJECTED`) funciona como **portão**: só avance para a
próxima etapa com o veredicto positivo.

> **Onde esta skill roda:** sempre no **fluxo principal** — só o agente principal tem o
> tool `Agent` para disparar subagentes. **Nunca** delegue a orquestração a um subagente
> (subagentes não têm o tool `Agent` e não conseguem acionar outros agentes). Cada `cy-*`
> precisa do tool `Skill` no seu frontmatter para carregar a skill de padrão correspondente.

### Mapa agente → skill por etapa

| Etapa | Agente (`subagent_type`) | Skill que o agente aciona |
|---|---|---|
| Especificação (PRD/TechSpec/Tasks) | **fluxo principal** (não é subagente) | `cy-create-prd` / `cy-create-techspec` / `cy-create-tasks` |
| Model / Store / Componente | `cy-frontend-developer` | `frontend-dev` (+ `api-integration` se houver API; + `table-generator` se o componente for uma listagem tabular com `DataTable`) |
| Revisão de componentização (portão) | `cy-component-specialist` | `frontend-dev` |
| Testes (portão) | `cy-qa-engineer` | `test-generator` |
| Code review (portão) | `cy-code-reviewer` | `code-review` |
| Decisão final (portão) | `cy-tech-lead` | `cy-final-verify` |
| Investigação de bug | `cy-bug-investigator` | `bug-investigator` |

---

## Passo 0 — Descobrir e ler a especificação

A fase de spec (PRD → TechSpec → Tasks) é **interativa** e roda no **fluxo principal**
(via comando `/tarefa`), nunca em subagente. Quando esta skill é invocada, a spec
**normalmente já foi produzida**. Antes de qualquer coisa, descubra o estado da cadeia:

1. Derive o `<ticket>-<slug>` da feature (ticket a partir do prefixo numérico da branch
   git atual) e procure artefatos em `../ppov-docs/issues/front/<ticket>-<slug>/`:
   `prd.md`, `techspec.md`, `tasks.md`. Procure também um PRD avulso em `docs/`
   (ex.: `docs/PRD-*.md`) com Glob/Grep — **não assuma que não há spec só porque os
   arquivos de implementação não existem**.
2. Roteie pelo **estado do pipeline de spec** (não pelo que já foi codado):
   - **Há `tasks.md`** → leia as tarefas e siga para o modo de implementação.
   - **Há `prd.md`/`techspec.md` mas falta `tasks.md`** → a spec está incompleta;
     **pare e devolva ao fluxo principal** (`/tarefa`) para continuar a cadeia interativa
     a partir do artefato faltante. Não tente gerar techspec/tasks aqui (esta skill não
     interage com o usuário).
   - **Não há nenhum artefato de spec** → idem: devolva ao fluxo principal para rodar
     `cy-create-prd`.

Da spec, extraia para guiar a implementação:

- **O que** precisa ser criado ou alterado
- **Qual o comportamento esperado** (regras de negócio, validações, fluxo do usuário)
- **Quais endpoints de API** serão consumidos (se houver)
- **O que já existe** no projeto (use Glob/Grep para verificar)

---

## Modo 1 — Implementação do zero

Use quando nenhum dos arquivos principais existe ainda.

```
ETAPA 0 → Especificação        (fluxo principal /tarefa)  ← se ainda não houver tasks.md
ETAPA 1 → Model (DTO)          (cy-frontend-developer)
ETAPA 2 → Store Pinia          (cy-frontend-developer) (depende do Model)
ETAPA 3 → Componente Vue       (cy-frontend-developer) (se necessário)
ETAPA 4 → Componente Vue       (cy-frontend-developer) (depende da Store)
ETAPA 5 → Componentização      (cy-component-specialist) ── portão APPROVED/REJECTED
ETAPA 6 → Testes               (cy-qa-engineer)          ── portão APPROVED/REJECTED
ETAPA 7 → Code Review          (cy-code-reviewer)        ── portão APPROVED/REJECTED
ETAPA 8 → Decisão final        (cy-tech-lead)            ── APPROVED / RETURN_TO_DEVELOPER
```

### Etapa 0 — Especificação (se ainda não houver `tasks.md`)
- **Quem executa:** o fluxo principal (`/tarefa`), **não** um subagente — as skills de spec
  são interativas e precisam perguntar ao usuário.
- Skills (no fluxo principal): `cy-create-prd` → `cy-create-techspec` → `cy-create-tasks`,
  gravando em `../ppov-docs/issues/front/<ticket>-<slug>/`. Continuar a partir do primeiro
  artefato faltante; não recriar o que já existe (um PRD avulso em `docs/` deve ser
  importado para `../ppov-docs/issues/front/<ticket>-<slug>/prd.md`).
- ✅ Verificar: `tasks.md` existe e permite implementação sem perguntas adicionais?

### Etapa 1 — Model (DTO)
- Agente: `cy-frontend-developer` → skill `api-integration`
- Criar `models/INomeDTO.ts` com a tipagem completa
- Criar tipos auxiliares: `INomeCriarDTO`, `INomeAtualizarDTO`
- ✅ Verificar: interface cobre todos os campos do endpoint? Tipos auxiliares omitem campos do servidor?

### Etapa 2 — Store Pinia
- Agente: `cy-frontend-developer` → skill `frontend-dev`
- Criar `stores/useNomeStore.ts`
- Implementar: state, getters, actions com loading/error/finally
- ✅ Verificar: todas as actions têm `loading`, `error = null` e `finally`? Retornam os tipos corretos?

### Etapa 3 — Componente Vue
- Agente: `cy-frontend-developer` → skills `frontend-dev` + `api-integration` (se consumir API diretamente)
- **Se o componente for uma listagem tabular com `DataTable`** (tabela/grid/CRUD de listagem),
  o agente usa a skill `table-generator` em vez de montar a tabela do zero. As perguntas de
  refinamento dessa skill (modal? filtros? paginação/ordenação?) devem ser respondidas pelo
  usuário no **fluxo principal** e repassadas na spec antes de delegar.
- Criar `components/NomeComponente.vue` com `<script setup lang="ts">`
- Aplicar responsividade mobile-first (checar `references/responsividade.md`)
- Adicionar `data-testid` em todos os elementos interativos
- ✅ Verificar: sem lógica de negócio no componente? Props e emits tipados? PrimeVue sem import manual?

### Etapa 4 — Revisão de componentização (portão)
- Agente: `cy-component-specialist` → skill `frontend-dev`
- Revisar responsabilidade única, reutilização, acoplamento, props, eventos
- ✅ Portão: veredicto `APPROVED`? Se `REJECTED`, devolver à Etapa 2–4 (`cy-frontend-developer`) e re-revisar.

### Etapa 5 — Testes (portão)
- Agente: `cy-qa-engineer` → skill `test-generator`
- Criar `mocks/NomeHandlers.ts` (MSW) se houver chamadas de API
- Criar `stores/useNomeStore.spec.ts`
- Criar `components/NomeComponente.spec.ts`
- ✅ Portão: happy path + edge cases + erro cobertos? Todos os `data-testid` existem? Veredicto `APPROVED`?

### Etapa 6 — Code Review (portão)
- Agente: `cy-code-reviewer` → skill `code-review`
- Revisar todos os arquivos criados
- ✅ Portão: nenhum blocker? Warnings endereçados ou justificados? Veredicto `APPROVED`?

### Etapa 7 — Decisão final (portão)
- Agente: `cy-tech-lead` → skill `cy-final-verify`
- Validar requisitos, evidência fresca de `yarn test`, resultados de QA e review
- ✅ Portão: `APPROVED` encerra a feature. `RETURN_TO_DEVELOPER` reinicia o ciclo a partir da Etapa 2.

---

## Modo 2 — Alteração de feature existente

Use quando parte da estrutura já existe e precisa ser modificada.

```
ETAPA 1 → Ler especificação + mapear impacto   (orchestrator)
ETAPA 2 → Alterar Model                         (cy-frontend-developer)
ETAPA 3 → Alterar Store                         (cy-frontend-developer)
ETAPA 4 → Alterar Componente                    (cy-frontend-developer)
ETAPA 5 → Revisar componentização               (cy-component-specialist) ── portão
ETAPA 6 → Verificar/atualizar testes            (cy-qa-engineer)          ── portão
ETAPA 7 → Code Review das alterações            (cy-code-reviewer)        ── portão
ETAPA 8 → Decisão final                         (cy-tech-lead)            ── portão
```

### Etapa 1 — Mapear impacto
Antes de tocar em qualquer arquivo, responda:

```
Arquivos impactados:
- models/INomeDTO.ts          → [ ] sim  [ ] não
- stores/useNomeStore.ts      → [ ] sim  [ ] não
- components/NomeComponente.vue → [ ] sim  [ ] não
- testes relacionados          → [ ] sim  [ ] não (sempre sim se alterou store)
```

Use Grep para encontrar onde o artefato alterado é referenciado:
```bash
grep -r "NomeQueVaiMudar" src/ --include="*.ts" --include="*.vue"
```

### Etapa 2 — Alterar Model
- Agente: `cy-frontend-developer` → skill `api-integration`
- Apenas se o contrato da API mudou ou novos campos foram adicionados
- ✅ Verificar: a mudança quebra algum uso existente do tipo? (TypeScript vai apontar)

### Etapa 3 — Alterar Store
- Agente: `cy-frontend-developer` → skill `frontend-dev`
- Alterar apenas o necessário — não refatorar o que não está no escopo
- ✅ Verificar: loading/error ainda gerenciados corretamente? Nenhuma action perdeu o `finally`?

### Etapa 4 — Alterar Componente
- Agente: `cy-frontend-developer` → skill `frontend-dev`
- ✅ Verificar: responsividade mantida? `data-testid` dos novos elementos adicionados?

### Etapa 5 — Revisar componentização (portão)
- Agente: `cy-component-specialist` → skill `frontend-dev`
- ✅ Portão: veredicto `APPROVED`? Se `REJECTED`, devolver à Etapa 3–4.

### Etapa 6 — Verificar testes existentes (portão)
- Agente: `cy-qa-engineer` → skill `test-generator`
- Leia os arquivos `.spec.ts` existentes antes de alterar
- Identifique quais testes quebram com a mudança
- Atualize os testes afetados e adicione casos para o novo comportamento
- ✅ Portão: nenhum teste foi simplesmente deletado para "passar"? Novos cenários cobertos? `APPROVED`?

### Etapa 7 — Code Review (portão)
- Agente: `cy-code-reviewer` → skill `code-review`
- Focar nas áreas alteradas
- ✅ Portão: a alteração não introduziu regressões nas partes não modificadas? `APPROVED`?

### Etapa 8 — Decisão final (portão)
- Agente: `cy-tech-lead` → skill `cy-final-verify`
- ✅ Portão: `APPROVED` encerra. `RETURN_TO_DEVELOPER` reinicia a partir da Etapa 2.

---

## Modo 3 — Correção de bug

Use quando a tarefa é investigar e corrigir um comportamento incorreto em código existente.

```
ETAPA 1 → Investigar causa raiz    (cy-bug-investigator)
ETAPA 2 → Corrigir o código        (cy-frontend-developer)
ETAPA 3 → Ajustar / criar testes   (cy-qa-engineer)      ── portão
ETAPA 4 → Code Review              (cy-code-reviewer)    ── portão
ETAPA 5 → Decisão final            (cy-tech-lead)        ── portão
```

### Etapa 1 — Investigar causa raiz
- Agente: `cy-bug-investigator` → skill `bug-investigator`
- Coletar sintoma, layer afetado e hipóteses antes de abrir qualquer arquivo
- Confirmar a causa raiz com evidências do código (arquivo + linha)
- ✅ Verificar: causa raiz identificada e confirmada? Relatório de investigação emitido?

### Etapa 2 — Corrigir o código
- Agente: `cy-frontend-developer` → skill `frontend-dev` (componente / store) ou `api-integration` (chamada HTTP / DTO)
- Aplicar **somente** a correção necessária — não refatorar o que não está no escopo do bug
- ✅ Verificar: a correção endereça a causa raiz identificada na Etapa 1? Não introduziu regressão?

> Observação: o agente `cy-bug-investigator` pode aplicar a correção ele mesmo quando ela
> é pontual e diretamente derivada do diagnóstico. Para correções que envolvem nova
> estrutura (store/componente), delegue a Etapa 2 ao `cy-frontend-developer`.

### Etapa 3 — Ajustar / criar testes (portão)
- Agente: `cy-qa-engineer` → skill `test-generator`
- Se o bug não tinha cobertura: criar o teste que o teria detectado
- Se o teste existente estava errado: corrigi-lo (nunca deletar para "passar")
- ✅ Portão: o teste falha antes do fix e passa depois? Cenário de erro coberto? `APPROVED`?

### Etapa 4 — Code Review (portão)
- Agente: `cy-code-reviewer` → skill `code-review`
- Focar na correção e nos testes adicionados
- ✅ Portão: nenhum blocker? Fix não cria nova dívida técnica? `APPROVED`?

### Etapa 5 — Decisão final (portão)
- Agente: `cy-tech-lead` → skill `cy-final-verify`
- ✅ Portão: `APPROVED` encerra. `RETURN_TO_DEVELOPER` reinicia a partir da Etapa 2.

---

## Fechamento (após `APPROVED` do `cy-tech-lead`)

Quando o `cy-tech-lead` emitir `APPROVED`, encerre o fluxo com:

1. Rodar `yarn test` no fluxo principal como **evidência fresca** de que a suíte passa
   (não confie apenas no relato dos agentes).
2. Deixar o diff pronto para o usuário revisar e commitar. **Não faça `git commit` nem
   `git push` automaticamente** nesta trilha ad-hoc — os hooks de `.claude/settings.json`
   já barram commit/push com testes falhando e rodam um code review automático no momento
   do commit. O commit final é manual.

> Auto-commit existe **apenas** na trilha de PRD formal (skill `cy-execute-task`), não aqui.

---

## Loop de portões e limite de iteração

Os portões das Etapas de revisão (componentização, testes, code review, decisão final)
podem devolver o fluxo ao `cy-frontend-developer`:

```
cy-frontend-developer → cy-component-specialist → cy-qa-engineer → cy-code-reviewer → cy-tech-lead
        ▲                                                                                  │
        └────────────────────── REJECTED / RETURN_TO_DEVELOPER ────────────────────────────┘
```

Teto de **3 voltas** completas. Se após a 3ª devolução a entrega ainda não estiver
aprovada, o `cy-tech-lead` emite `REQUER_REVISÃO_HUMANA` — pare o loop e reporte ao usuário.

---

## Detecção automática de modo

Primeiro garanta a spec (Passo 0): se faltar `tasks.md`, devolva ao fluxo principal
(`/tarefa`) antes de escolher o modo. **Ter spec não implica Modo 1** — a existência de
PRD/TechSpec/Tasks é independente de já existir código. Com a spec pronta, identifique o
modo pelo estado do **código de implementação**:

```
Contém palavras como "cria", "nova", "implementa", "adiciona" + não há arquivo existente
→ Modo 1 (Implementação)

Contém palavras como "altera", "muda", "ajusta", "atualiza" + arquivo já existe
→ Modo 2 (Alteração)

Arquivo existe mas a task pede funcionalidade nova dentro dele
→ Modo 2, mas com etapas de criação dentro das etapas de alteração

Contém palavras como "bug", "erro", "quebrou", "não funciona", "comportamento errado",
"stack trace", "regressão" + código já existe
→ Modo 3 (Correção de bug)
```

> Se durante o Modo 1 ou Modo 2 um bug for descoberto em código existente (não relacionado
> à tarefa em andamento), pause, delegue ao agente `cy-bug-investigator` para investigar,
> resolva, e só então retome a task original.

---

## Checklist de saída (antes de encerrar qualquer tarefa)

- [ ] Todos os arquivos previstos no plano foram criados/alterados
- [ ] TypeScript compila sem erros (`nuxt typecheck` ou `vue-tsc`)
- [ ] Testes cobrem o que foi implementado/alterado
- [ ] `cy-component-specialist` aprovou a componentização
- [ ] `cy-qa-engineer` aprovou os testes
- [ ] `cy-code-reviewer` aprovou (veredicto ✅ APPROVED)
- [ ] `cy-tech-lead` emitiu `APPROVED` na decisão final
- [ ] Responsividade aplicada (mobile-first)
- [ ] Nenhuma lógica de negócio vazou para o componente

---

## Comunicação com o usuário

A cada etapa concluída, informe o agente que atuou e o veredicto:

```
✅ Etapa X concluída — [nome da etapa] (agente: cy-xxx)
   Arquivos: [lista dos arquivos criados/alterados]
   Veredicto: APPROVED
   Próximo: Etapa Y — [nome] (agente: cy-yyy)
```

Se uma etapa revelar um problema que muda o plano, pare e informe antes de continuar:

```
⚠️ Atenção: ao analisar [arquivo], o agente [cy-xxx] identificou que [problema].
   Isso afeta o plano porque [motivo].
   Sugestão: [alternativa]. Deseja continuar assim?
```
