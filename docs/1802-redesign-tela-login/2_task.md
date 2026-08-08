---
status: pending
title: Implementar form completo, interações e acessibilidade
type: frontend
complexity: medium
dependencies:
  - 1_task
---

# Implementar form completo, interações e acessibilidade

## Visão Geral

Completa a coluna do formulário da nova tela de login: labels visíveis, toggle de senha (olho), checkbox "Lembrar de mim" (somente visual), link "Esqueci minha senha" placeholder, botão "Entrar" com estado de carregamento e rodapé legal. Também garante acessibilidade (labels, `aria-label` no toggle, `aria-disabled` no link sem ação) e o tratamento de erro/estado carregando sem alterar a lógica de autenticação.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie a seção "Elementos do Formulário" da TechSpec para os patterns de inputs e do botão.
- FOCUS no "quê" — o que o form deve fazer, preservando `handleLogin` existente.
- Não crie componentes novos; tudo fica em `app/login/page.tsx`.
- Testes são obrigatórios (validação: `npx tsc --noEmit`, `npm run lint`, `npm run build`).
- Execute a verificação final após o fim da implementação.
</critical>

<requirements>
- O formulário DEVE ter labels visíveis associados aos inputs de email e senha (receita dark atual).
- A senha DEVE ter toggle de mostrar/ocultar como botão (`type="button"`) com `aria-label` descritivo, alternando o `type` do input.
- O checkbox "Lembrar de mim" DEVE ser apenas visual (mude o estado visual; nenhum efeito de persistência) conforme decisão do MVP.
- O link "Esqueci minha senha" DEVE ser placeholder (`aria-disabled`, sem navegação) conforme ADR-003; não deve induzir clique.
- O botão "Entrar" DEVE exibir estado de loading ("Entrando...") com `disabled` enquanto autentica, mantendo a chamada `signInWithPassword`.
- Mensagens de erro DEVE manter o padrão de banner vermelho atual (`bg-red-500/10 border-red-500/20 text-red-400`).
- O rodapé legal DEVE exibir "Termos de uso" e "Privacidade" como links placeholder separados por `·` e o copyright ("© 2026 CobrançaIA").
- Não deve haver validação manual de email além do nativo `type="email"` e `required`.

## Subtasks
- [ ] 2.1 Implantar os dois inputs (email/password) com labels e estilização dark atual.
- [ ] 2.2 Adicionar o botão toggle de senha (Eye/EyeOff) com `aria-label` e alternância de tipo.
- [ ] 2.3 Adicionar checkbox "Lembrar de mim" (estado visual) e link "Esqueci minha senha" placeholder.
- [ ] 2.4 Manter o botão primário com carregamento e o banner de erro atuais.
- [ ] 2.5 Incluir o rodapé legal com links placeholder.
- [ ] 2.6 Assegurar acessibilidade dos controles novos (aria-label, aria-disabled, foco).

## Detalhes de Implementação
- Arquivo a modificar: `app/login/page.tsx`.
- Patterns: veja a seção "Elementos do Formulário" da TechSpec.
- `handleLogin` permanece; apenas o `error`, `loading` e `setError` existentes são reutilizados.
- Ícones: `Eye`, `EyeOff`, `LogIn`, `Lock`, `Mail`.

### Arquivos Relevantes
- `app/login/page.tsx` — onde tudo é implementado.
- `lib/supabase.ts` — cliente usado no `handleLogin` (não modificar).

### Arquivos Dependentes
- Nenhum outro arquivo é afetado; mudança confinada a `app/login/page.tsx`.

### ADRs Relacionados
- [ADR-002: Identidade visual](adrs/adr-002.md) — estados de foco/botoão em esmeralda.
- [ADR-003: "Esqueci minha senha" placeholder](adrs/adr-003.md) — link visual sem fluxo real.
- [ADR-004: Implementação single-file](adrs/adr-004.md) — form dentro de `app/login/page.tsx`.

## Entregáveis
- Campos email/senha com labels, toggle, checkbox, link, botão e rodapé integrados ao layout da tarefa 1.
- Acessibilidade de tone (aria-label, aria-disabled, links sem navegação).
- Validação: `npx tsc --noEmit` sem erros **(REQUERIDO)**.
- `npm run lint` sem erros **(REQUERIDO)**.

## Testes
- **Unitários** (via validação: tsc/lint — sem suite de testes no projeto):
  - [ ] Compilação de tipos sem erros (`npx tsc --noEmit`).
  - [ ] Lint sem erros (`npm run lint`).
- **Integração (manuais)**:
  - [ ] Toggle de senha mostra/oculta o conteúdo do input.
  - [ ] Submeter com credenciais inválidas apresenta banner de erro.
  - [ ] Submeter com credenciais válidas redireciona para `/`.
  - [ ] Botão fica `disabled` e aparece "Entrando..." durante o envio.
  - [ ] "Lembrar de mim" altera o visual sem efeito de persistência.
  - [ ] Link "Esqueci minha senha" não navega nem quebra (sem scroll/toast).
- Target de cobertura: não aplicável (sem suite; validação manual + tooling).
- Build final: `npm run build` sem erros.

## Critérios de Sucesso
- A coluna de form rodou no layout split-screen da tarefa 1.
- Todas as validações (tsc, lint, build) passam.
- Interações (toggle, loading, erro) funcionam manualmente.
- Acessibilidade dos controles novos garantida.