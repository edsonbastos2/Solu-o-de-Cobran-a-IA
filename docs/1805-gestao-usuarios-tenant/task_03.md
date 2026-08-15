---
status: pending
title: "hooks/useAuth.ts: expor role/canConfigureAI, corrigir fallback de member"
type: frontend
complexity: baixa
dependencies:
  - task_02
---

# Tarefa 03: Atualizar `hooks/useAuth.ts` para o modelo de papéis de 4 níveis

## Visão Geral

`hooks/useAuth.ts` é a fonte de verdade do lado do cliente que a interface usa para ocultar/mostrar as ações de criar/editar/excluir e a aba de configuração de IA. Atualmente tipa `role` como o conjunto antigo de 3 valores e converte silenciosamente qualquer papel não reconhecido para `'member'` — após a migração da task_01, `'member'` não existe mais como valor válido, então esse fallback silencioso deve mirar o novo papel piso, ou a interface de todo usuário existente deturparia as permissões dele na próxima sessão.

<critical>
- SEMPRE LEIA o PRD e a TechSpec antes de começar (`../prd.md`, `../techspec.md`).
- REFERENCIE 'Interfaces Principais'/'Análise de Impacto' da TechSpec — `hooks/useAuth.ts` é explicitamente destacado como arquivo de risco conhecido (fallback silencioso).
- FOQUE NO "O QUÊ" — exponha a forma correta; não reestruture o design geral do hook.
- MINIMIZE CÓDIGO — diff pequeno e direcionado a um arquivo existente de 91 linhas.
- TESTES OBRIGATÓRIOS — verificação manual em todos os quatro papéis.
</critical>

<requirements>
- DEVE mudar o tipo exportado `TenantRole` (atualmente `'owner' | 'admin' | 'member'`, linha 19) para `'owner' | 'admin' | 'gestor' | 'operador'`.
- DEVE atualizar a lógica de normalização do `fetchProfile` (atualmente `r === 'owner' || r === 'admin' || r === 'member' ? r : 'member'`, linha 53) para verificar todos os quatro valores e padronizar valores não reconhecidos para `'operador'`.
- DEVE estender o select de `tenant_members` (atualmente `'role'`, linha 45) para também buscar `can_configure_ai`, e expor um novo estado `canConfigureAI: boolean`, computado da mesma forma que o `lib/api-auth.ts` do lado do servidor (`role in ('owner','admin')` OU `can_configure_ai === true`), padronizando para `false` enquanto `role` é `null`/carregando.
- DEVE retornar `canConfigureAI` junto com o `{ user, profile, role, session, loading, isConfigured }` existente do hook.
- NÃO DEVE mudar a estrutura geral do hook (padrão de listener de sessão/mudança de estado de auth) — isto é uma extensão direcionada, não uma reescrita.
</requirements>

## Subtarefas
- [ ] 03.1 Atualizar a exportação do tipo `TenantRole`.
- [ ] 03.2 Estender o select de `tenant_members` e adicionar o estado `canConfigureAI` + computação.
- [ ] 03.3 Corrigir a normalização de fallback para padronizar para `'operador'` em vez de `'member'`.
- [ ] 03.4 Atualizar o valor de retorno do hook para incluir `canConfigureAI`.
- [ ] 03.5 Buscar no codebase consumidores existentes do `role` de `useAuth()` que façam pattern-match em `'member'` e confirmar que nenhum existe (esperado: nenhum hoje, já que esta é a primeira funcionalidade a diferenciar papéis na interface) — sinalizar qualquer um encontrado para conhecimento da task_04/06 em vez de corrigi-los aqui se estiver fora do escopo de arquivos desta tarefa.

## Detalhes de Implementação

Normalização atual (`hooks/useAuth.ts:51-54`):
```typescript
if (membership?.role) {
  const r = String(membership.role).toLowerCase();
  setRole(r === 'owner' || r === 'admin' || r === 'member' ? r : 'member');
}
```
Substitua a allow-list e o alvo do fallback conforme os requisitos acima. Siga exatamente a fórmula de computação de `canConfigureAI` da TechSpec para que cliente e servidor nunca discordem sobre o que um papel pode fazer.

### Arquivos Relevantes
- `hooks/useAuth.ts` — o arquivo inteiro (91 linhas) é o alvo; `fetchProfile` (linhas 35-58) é a função específica a mudar.

### Arquivos Dependentes
- `components/team-management-panel.tsx` (task_06) — consome `role`/`canConfigureAI` para decidir se o usuário atual vê os controles de convidar/editar/remover.
- `app/(dashboard)/settings/page.tsx` (task_06) — consome `role` para decidir se renderiza a nova aba "Equipe" (apenas owner/admin devem vê-la, conforme o PRD: apenas owner/admin administram membros da equipe).
- Qualquer outro componente que leia `useAuth().role` para proteger um botão de criar/editar/excluir — a task_04 é limitada às rotas de API, mas observe na descrição do PR desta tarefa que a proteção no lado da interface dos botões CRUD existentes (correspondendo à nova distinção `gestor`/`operador`) faz parte do escopo "Interface de gestão de equipe" da task_06 apenas na medida em que toca a própria tela de Configurações/Equipe; ocultação de botões mais ampla em toda a interface para o `operador` em todas as páginas existentes está explicitamente fora do escopo deste ticket conforme o PRD (ver Não-Objetivos), a menos que a Análise de Impacto da TechSpec destaque uma tela específica.

## Entregáveis
- `hooks/useAuth.ts` exportando `TenantRole` de 4 valores e `canConfigureAI`.
- `npx tsc --noEmit` passa.
- Verificação manual em todos os quatro papéis (ver Testes).

## Testes
- Manual (sem suíte de testes de frontend automatizada neste repositório):
  - [ ] Entrar como usuário com `tenant_members.role = 'owner'` produz `role === 'owner'` e `canConfigureAI === true`.
  - [ ] Entrar como `role = 'gestor'`, `can_configure_ai = false` produz `canConfigureAI === false`.
  - [ ] Entrar como `role = 'operador'`, `can_configure_ai = true` produz `role === 'operador'` e `canConfigureAI === true`.
  - [ ] Uma linha `tenant_members` com uma string de papel não reconhecida (simulada, não deve ocorrer pós-migração) normaliza para `role === 'operador'`, não um crash ou `undefined`.
  - [ ] Estados de `loading` e não autenticado deixam `role`/`canConfigureAI` em seus padrões seguros (`null`/`false`), correspondendo ao comportamento atual para o caso não autenticado.
- Alvo de cobertura de teste: todos os quatro papéis + um caso de borda de valor não reconhecido exercitados manualmente.

## Critérios de Sucesso
- Todos os quatro papéis verificados ponta a ponta de uma linha `tenant_members` real (ou semeada) até o valor de retorno do hook.
- Nenhuma referência restante a `'member'` em `hooks/useAuth.ts`.
- `npx tsc --noEmit` e `npm run lint` limpos.