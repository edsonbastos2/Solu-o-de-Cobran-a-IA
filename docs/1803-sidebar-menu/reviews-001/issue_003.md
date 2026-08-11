---
status: pending
file: lib/navigation.ts
line: 38
severity: low
author: claude-code
provider_ref:
---

# Issue 003: Ícone compartilhado (Shield) entre Políticas e Painel Admin; Bot em Contratos

## Review Comment

Em `lib/navigation.ts`, "Políticas" e "Painel Admin" usam o mesmo ícone `Shield`, o
que reduz a diferenciação visual entre seções de topo ("Operação" eq "Configuração")
e itens de mesmo atributo. "Contratos" usa `Bot`, que é o mesmo ícone da marca
(logotipo no AppSidebar), criando duplicação de identidade visual.

Sugestão: definir ícones distintos com carga semântica — por exemplo `ShieldCheck`
para "Políticas" e `ShieldAlert`/`Users` para "Painel Admin"; para "Contratos"
`FileText` ou `ScrollText`. Ajustes cosméticos, sem impacto funcional, mas alinham
o menu com a marca escura + emerald e melhoram a navegação por ícone em estado
colapsado (onde só o ícone aparece).

## Triage

- Decision: `UNREVIEWED`
- Notes: