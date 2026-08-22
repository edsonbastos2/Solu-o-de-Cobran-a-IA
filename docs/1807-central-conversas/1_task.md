---
status: completed
title: Infraestrutura de testes (Vitest + RTL + jsdom)
type: test
complexity: low
dependencies: []
---

# Task 01: Infraestrutura de testes (Vitest + RTL + jsdom)

## Overview

O projeto não possui nenhuma suite de testes automatizados (validação atual: lint + build + checklist manual). Esta task introduz Vitest + React Testing Library + jsdom como infraestrutura base, permitindo que todas as tasks seguintes embutam testes unitários de componentes e domínio conforme ADR-004.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST instalar como devDependencies: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`
- MUST criar `vitest.config.ts` com environment jsdom, plugin React e resolve alias `@/*` → raiz do projeto (mesmo mapeamento do `tsconfig.json`)
- MUST adicionar scripts `test` (vitest run) e `test:watch` (vitest) ao `package.json`
- MUST configurar setup global (`setupFiles`) importando `@testing-library/jest-dom`
- MUST incluir um smoke test que valide o ambiente (render de um componente trivial + asserção)
- MUST garantir que `npm run build` e `npm run lint` continuam passando (vitest.config.ts e arquivos `*.test.*` não podem quebrar o typecheck do Next)
- NÃO deve configurar coverage agora (YAGNI — sem `@vitest/coverage-v8` nesta fase)
</requirements>

## Subtasks
- [ ] 1.1 Instalar dependências de dev
- [ ] 1.2 Criar `vitest.config.ts` com alias `@/*`, jsdom e setup global
- [ ] 1.3 Criar setup file com jest-dom
- [ ] 1.4 Adicionar scripts `test` e `test:watch` no `package.json`
- [ ] 1.5 Criar smoke test co-localizado (ex.: `components/smoke.test.tsx`)
- [ ] 1.6 Validar: `npm test`, `npm run lint`, `npm run build`

## Implementation Details

Configuração mínima: `vitest.config.ts` na raiz, `defineConfig` de `vitest/config`, `plugins: [react()]`, `test.environment: 'jsdom'`, `resolve.alias: { '@': path.resolve(__dirname) }`. Excluir `.next` e `node_modules`. TypeScript strict do projeto aplica-se aos testes.

### Relevant Files
- `package.json` — scripts e devDependencies
- `tsconfig.json` — fonte do alias `@/*` a replicar
- `next.config.ts` — referência de transpilePackages (não interferir)

### Dependent Files
- Todos os `*.test.ts(x)` das tasks 03–10 dependem desta infraestrutura

### Related ADRs
- [ADR-004: Vitest + React Testing Library com testes co-localizados](../adrs/adr-004.md)

## Deliverables
- `vitest.config.ts` funcional com alias e jsdom
- Scripts `test`/`test:watch` no `package.json`
- Smoke test passando

## Tests
- Unit tests:
  - [ ] Smoke test: renderiza componente trivial e assertion `toBeInTheDocument()` passa
  - [ ] Alias `@/` resolve corretamente dentro de um teste (import de `lib/utils.ts` e uso de `cn()`)
- Integration tests:
  - [ ] `npm test` roda do zero em máquina limpa (pós `npm install`)
- Test coverage target: N/A (infraestrutura)
- All tests must pass

## Success Criteria
- `npm test` passa; `npm run lint` e `npm run build` sem regressão
- Base pronta para as tasks 03–10 escreverem testes co-localizados
