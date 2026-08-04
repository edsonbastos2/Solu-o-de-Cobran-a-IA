# Template de Tarefa

Estrutura canônica para cada arquivo de tarefa (`N_task.md`).

```yaml
---
status: pending
title: [Título da Tarefa]
type: [frontend|backend|api|supabase|ai|whatsapp|docs|refactor|chore|bugfix]
complexity: [low|medium|high|critical]
dependencies: []
---
```

# [Título da Tarefa]

## Visão Geral

[2-3 frases descrevendo o que a tarefa realiza e por quê.]

<critical>
- Leia PRD e TechSpec antes de implementar
- Referencie as seções relevantes do TechSpec
- Foque no QUÊ entregar, não no COMO
- Minimize alterações de código ao necessário
- Testes são obrigatórios
- Execute `npm run lint && npm run build` como pipeline de verificação
</critical>

<requirements>
1. [Requisito técnico específico usando linguagem DEVE/DEVERIA]
2. ...
</requirements>

## Subtarefas

- [ ] [Subtarefa 1]
- [ ] [Subtarefa 2]
- [ ] ...

## Detalhes de Implementação

### Arquivos a Criar

- `caminho/para/arquivo.tsx` — [propósito]

### Arquivos a Modificar

- `caminho/para/arquivo.ts` — [o que mudar]

### Arquivos Relevantes

- `caminho/arquivo.ts` — [razão pela qual é relevante]

### Arquivos Dependentes

- `caminho/arquivo.tsx` — [como será afetado por esta tarefa]

### ADRs Relacionados

- [ADR-NNN: Título](adrs/adr-NNN.md) — [resumo]

## Entregáveis

- [ ] [Entregável concreto 1]
- [ ] [Entregável concreto 2]
- [ ] Testes com cobertura >=70%

## Testes

### Testes Unitários

- [ ] [Caso de teste específico com entrada/condição]
- [ ] [Caso de teste específico com entrada/condição]

### Testes de Integração

- [ ] [Caso de teste específico com entrada/condição]
- [ ] [Caso de teste específico com entrada/condição]

## Critérios de Sucesso

- [ ] Todos os testes passando
- [ ] Cobertura de testes >=70%
- [ ] TypeScript compila sem erros (`npm run build`)
- [ ] ESLint sem erros (`npm run lint`)
- [ ] [Outros critérios específicos da tarefa]
