---
status: pending
title: Reescrever `app/login/page.tsx` com layout split-screen
type: frontend
complexity: medium
dependencies: []
---

# Reescrever `app/login/page.tsx` com layout split-screen

## Visão Geral

Converte o card centralizado atual em um layout split-screen responsivo com coluna de branding à esquerda (gradiente azul/roxo + glow esmeralda, logo, 3 benefícios com ícones lucide, ilustração em composição CSS e avatares com nota) e a coluna do formulário à direita. A lógica de autenticação existente (`handleLogin`, `useEffect` de sessão) permanece intacta.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec (adi o resumo, layout e elementos da coluna de branding).
- Foque no "o quê" — comportamento e resultado da tela, sem duplicar o design de implementação da TechSpec.
- Minimize código — a feature é single-file em `app/login/page.tsx`; não crie novos componentes.
- Testes são obrigatórios: a validação é `npx tsc --noEmit`, `npm run lint` e `npm run build` (não há suite no projeto).
- Não altere `middleware.ts`, `lib/supabase.ts` nem a lógica de auth.
</critical>

<requirements>
1. A página DEVE apresentar grid `lg:grid-cols-2` em desktop e coluna única em telas menores que `lg`.
2. A coluna de branding DEVE manter fundo `#0c0d10`, gradiente decorativo azul/roxo (`from-indigo-500 to-purple-500`), glow com `shadow-emerald-500/20`, logo CobrançaIA (bloco emerald + ícone Bot) e o nome do produto.
3. A coluna de branding DEVE exibir 3 benefícios essenciais com ícones lucide e avatares genéricos com nota de confiança (social proof).
4. A lógica atual de auth (check de sessão em `useEffect`, `handleLogin` com `signInWithPassword` e redirect para `/`) DEVE ser preservada sem alteração de comportamento.
5. Não DEVE criar componentes novos; todo o conteúdo de branding DEVE ser constante/texto estático no arquivo.
6. O rodapé legal DEVE ter links "Termos de uso" e "Privacidade" como placeholder (sem href real) com copyright, conforme TechSpec.
</requirements>

## Subtasks
- [ ] 1.1 Reestruturar o JSX para o layout split-screen responsivo (`grid lg:grid-cols-2`), mantendo a montagem ativa do form.
- [ ] 1.2 Criar a coluna de branding: fundo, gradientes, logo, título/subtítulo, 3 benefícios e avatares com nota.
- [ ] 1.3 Implementar a ilustração em composição CSS (blobs/formas com gradientes e glow) sem assets externos.
- [ ] 1.4 Garantir colapso em uma coluna no mobile (partes não essenciais ocultas via `hidden lg:flex`).
- [ ] 1.5 Preservar inalterados `handleLogin`, `useEffect` de sessão e o `supabase` import.
- [ ] 1.6 Rodar `npx tsc --noEmit` e corrigir tipagem.

## Detalhes de Implementação

- Arquivo a modificar: `app/login/page.tsx`.
- Referências e pattern na TechSpec: seções "Resumo Executivo", "Elementos da Coluna de Branding" e "Layout (responsividade)". Não duplique o conteúdo aqui.
- Preservar o import `@/lib/supabase`, `motion` e `lucide-react` já presentes.

### Arquivos Relevantes
- `app/login/page.tsx` — arquivo único da feature; reescrito nesta tarefa.
- `lib/supabase.ts` — cliente browser usado pela página (não modificar).

### Arquivos Dependentes
- Nenhum outro arquivo funcional — a mudança é confinada a `app/login/page.tsx`.

### ADRs Relacionados
- [ADR-001: Layout split-screen](../adrs/adr-001.md) — define o layout de duas colunas e o colapse no mobile.
- [ADR-002: Identidade visual](adrs/adr-002.md) — esmeralda como accent, gradiente apenas decorativo.

## Entregas
- `app/login/page.tsx` reescrito com split-screen e branding.
- Nenhuma dependência nova no `package.json`.
- Validação: `npx tsc --noEmit` sem erros **(REQUERIDO)**.
- Validação: `npm run lint` sem erros **(REQUERIDO)**.

## Testes
- Unitários (via build/lint, sem suite de testes):
  - [ ] `npx tsc --noEmit` compila sem erros.
  - [ ] `npm run lint` não reporta problemas.
- Integração/manuais:
  - [ ] A tela renderiza com as duas colunas em viewport desktop.
  - [ ] Em viewport < `lg` a interface vira uma coluna sem perder o form.
  - [ ] Login com credenciais válidas redireciona para `/`.
  - [ ] Credenciais inválidas exibem banner de erro.
  - [ ] Já autenticado, a tela redireciona para `/`.
- Target de cobertura: não aplicável (sem suite de testes; uso de tip & manual).
- Experiência: `npm run build` conclui com sucesso.

## Critérios de Sucesso
- All tests e validações passando (tsc, lint, build).
- Lógica de auth idêntica (sem alteração de comportamento).
- Layout responsivo sem regressão visual.
- Sem dependências novas.