---
status: pending
file: components/ui/sidebar.tsx
line: 149
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: Drawer mobile sem gestão de foco e trigger sem aria-expanded

## Review Comment

O drawer mobile (branch `isMobile` em `Sidebar`) usa `role="dialog"`, `aria-label`
e `aria-modal`, mas não há gestão de foco: ao abrir o drawer o foco não é movido
para o painel, e ao fechar (Esc/backdrop/clique em item) o foco não retorna ao
trigger. Além disso, o `SidebarTrigger` (linha ~429) não expõe `aria-expanded`
nem `aria-controls` ligando ao painel.

A task 6 exige: "O drawer mobile DEVE abrir com foco gerenciado, fechar com Esc e
retornar o foco ao trigger" e"aria-label, aria-expanded, aria-modal DEVEM estar
corretos no drawer e no trigger".

Sugestão: no `SidebarProvider`, manter `triggerRef` da aba de abertura
(`setOpenMobile(true)`), aplicar um focus-trap leve no painel (ref + `first focusable`
no mount) e restaurar foco no `triggerRef` quando o drawer fechar. No
`SidebarTrigger`, adicionar `aria-expanded={isMobile ? openMobile : state==='expanded'}`
e `aria-controls` para o elemento `data-sidebar="sidebar"` mobile.

## Triage

- Decision: `UNREVIEWED`
- Notes: