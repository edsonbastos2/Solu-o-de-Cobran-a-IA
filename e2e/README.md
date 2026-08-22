# Testes E2E (Playwright)

Testes de ponta a ponta, separados da suíte unitária (Vitest, ver `vitest.config.ts`). Sobem `npm run dev` de verdade e dirigem um Chromium real contra ele — use para validar fluxos completos de UI, não para lógica isolada (isso é trabalho do Vitest).

## Rodando

```bash
npm run test:e2e        # roda tudo, headless
npm run test:e2e:ui     # abre o UI mode do Playwright (interativo, ótimo para debug)
npx playwright test e2e/smoke.spec.ts   # um arquivo específico
```

O `webServer` do `playwright.config.ts` sobe o `npm run dev` automaticamente antes dos testes (e reaproveita um dev server já rodando, fora de CI). Não precisa iniciar nada manualmente.

## Autenticação

Nenhum teste aqui usa login — o projeto não tem usuário de teste/seed documentado. `smoke.spec.ts` cobre apenas rotas públicas e o redirect do middleware para `/login` sem sessão.

Para testar fluxos autenticados no futuro, o caminho mais direto é:
1. Criar um usuário de teste no Supabase do projeto (dev/staging, nunca produção).
2. Fazer login uma vez via UI num `setup` project do Playwright, salvando o `storageState` (cookies de sessão) em `e2e/.auth/user.json`.
3. Reusar esse `storageState` nos demais testes via `test.use({ storageState: 'e2e/.auth/user.json' })`.

Ver [docs do Playwright sobre autenticação](https://playwright.dev/docs/auth) para o padrão completo. Adicione `e2e/.auth/` ao `.gitignore` antes de gerar credenciais salvas (nunca commitar sessão de usuário real).

## MCP do Playwright (uso interativo)

Para dirigir o navegador interativamente numa sessão do Claude Code (sem escrever um spec primeiro), o projeto também tem o MCP `playwright` configurado em `.mcp.json` — reinicie o Claude Code para conectá-lo. Uma vez conectado, dá pra navegar/clicar/tirar screenshot diretamente na conversa, sem passar por aqui.
