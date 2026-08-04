---
name: test-generator
description: >
  Use para validar código no projeto Next.js 15 + React 19 + Supabase.
  O projeto NÃO possui suite de testes automatizados — a validação é baseada em
  compilação TypeScript, ESLint e checklists manuais.

  Ative quando o usuário:
  - Perguntar "como testar isso?" ou "como validar?"
  - Pedir para criar testes ou validar implementação
  - Quiser verificar se o código está pronto para produção
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Test Generator Skill

Validação de código — compilação, lint e checklists manuais.

## Pipeline de Verificação

```bash
npm run lint      # ESLint (next/core-web-vitals + next/typescript)
npm run build     # TypeScript + build Next.js
npx tsc --noEmit  # TypeScript check sem build completo
```

## Checklist de Verificação

### Componente React (.tsx)
- [ ] `'use client'` presente se usa hooks/state/eventos
- [ ] Props tipadas com `interface Props`
- [ ] Estados cobertos: loading, error, empty, success
- [ ] `data-testid` em elementos interativos
- [ ] Responsividade: mobile, tablet, desktop
- [ ] Dark mode funciona
- [ ] Tailwind classes corretas (sem conflitos)
- [ ] Acessibilidade: roles, labels, focus

### Hook (.ts)
- [ ] SWR: null guard na key
- [ ] SWR: `mutate()` chamado após mutations
- [ ] Estados retornados: data, error, isLoading
- [ ] `useEffect` com cleanup quando necessário
- [ ] `useCallback`/`useMemo` com dependências corretas
- [ ] Tipos de retorno explícitos

### API Route (app/api/)
- [ ] `requireUser()` no início do handler
- [ ] `validateFields()` para input validation
- [ ] Supabase query com filtro correto
- [ ] Respostas com códigos HTTP apropriados
- [ ] Erros capturados e retornados como JSON

### Supabase RLS
- [ ] Nunca envia `user_id` manualmente (usuário comum)
- [ ] Dados de tenant isolados
- [ ] Token de sessão válido

## Verificação Rápida por Tipo de Mudança

| Mudança | Verificar |
|---------|-----------|
| Novo componente | `npm run build` + checklist visual (4 estados) |
| Hook alterado | `npm run build` + verificar consumers |
| API route | `npm run build` + testar com curl/Postman |
| Tipo alterado | `npx tsc --noEmit` (verificar imports) |
| Tailwind alterado | Inspeção visual em todos breakpoints |

## Padrões Futuros de Teste (React Testing Library)

Quando testes automatizados forem adicionados:

```typescript
// components/__tests__/CasesTable.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import CasesTable from '../cases-table';

function renderWithSWR(ui: React.ReactElement) {
  return render(
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      {ui}
    </SWRConfig>
  );
}

it('exibe loading state', () => {
  renderWithSWR(<CasesTable />);
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
});
```

## Anti-padrões

- ❌ Não crie testes de snapshot
- ❌ Não mocke `fetch` global — mocke `fetchWithAuth`
- ❌ Não teste detalhes de implementação (estado interno)
- ❌ Não pule `npm run build` assumindo que "deve passar"
- ✅ Prefira testar comportamento observável (renderização, eventos)
- ✅ Use `data-testid` para queries estáveis
