---
status: pending
file: hooks/use-mobile.ts
line: 6
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: useIsMobile lê innerWidth no initializer e causa mismatch de hydration

## Review Comment

`useIsMobile()` computa o estado inicial em `useState(() => window.innerWidth < 768)`
durante o render. No SSR de `SidebarProvider` isso retorna sempre `false` (variante
desktop), mas no primeiro render do cliente em um dispositivo < 768px retorna `true`
— o shell renderiza uma árvore diferente (drawer mobile vs sidebar desktop) entre
servidor e cliente, o que pode disparar erro de hydration no Next.js 15 e um flash
de layout errado no mobile até o efeito remontar o aforismo.

Esse hook é pré-existente, mas o novo `Sidebar`/`SidebarProvider` (task 2) passou a
ser o principal consumidor dessa variante reactiva no caminho do shell; no header
antigo o impacto era só visual de classe.

Sugestão: manter o estado `undefined` até o "mounted" (ex.: `useSyncExternalStore`
ou `useEffect` + segundo render), ou devolver `false` no SSR e trocar para `true`
somente via efeito após mount, para hidratar sempre a variante desktop e só então
trocar para mobile sem mismatch.

## Triage

- Decision: `UNREVIEWED`
- Notes: hook pré-existente; passou a ser caminho crítico do novo shell (task 2).