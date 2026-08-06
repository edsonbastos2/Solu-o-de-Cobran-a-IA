---
status: completed
title: Migrar a tela de contratos
type: frontend
complexity: medium
dependencies: ["7_task", "8_task"]
---

# Migrar a tela de contratos

## Visão Geral

Substituir a leitura de parcelas legadas pela leitura de títulos financeiros canônicos sem alterar a navegação principal. A ação de cobrança deve enviar apenas o identificador do título e exibir as regras de elegibilidade.

<critical>
- Leia a TechSpec e preserve a linguagem visual existente.
- Não permitir cobrança de título não elegível.
- Remover atualização separada e não atômica da parcela.
- Tratar loading, erro e mobile.
</critical>

<requirements>
1. A tela DEVE consumir `/api/financial-titles`.
2. A criação DEVE enviar `financial_title_id`.
3. Títulos futuros, pagos e cancelados DEVEM ser bloqueados.
4. Erro 409 DEVE explicar duplicidade ativa.
5. A navegação atual DEVE permanecer utilizável.
</requirements>

## Subtarefas

- [x] Substituir fonte de dados.
- [x] Ajustar botão/ação de cobrança.
- [x] Mapear mensagens de erro.
- [x] Verificar responsividade e acessibilidade.

## Detalhes de Implementação

### Arquivos a Criar

- Nenhum.

### Arquivos a Modificar

- `app/contracts/[id]/page.tsx` — títulos canônicos e criação.

### Arquivos Relevantes

- `app/api/financial-titles/route.ts` — endpoint.
- `app/api/cases/route.ts` — POST.
- `lib/types.ts` — tipos.

### Arquivos Dependentes

- `16_task.md` — validação final.

### ADRs Relacionados

- [ADR-004](adrs/adr-004.md) — título obrigatório.

## Entregáveis

- [x] Tela com títulos canônicos.
- [x] Abertura somente por título.
- [x] Estados de elegibilidade visíveis.

## Testes

### Testes Unitários

- [x] Cada estado de título produz ação/mensagem correta.

### Testes de Integração

- [x] Título futuro não mostra ação válida.
- [x] Título vencido cria caso.
- [x] Título pago/cancelado é bloqueado.
- [x] 409 é exibido de forma acionável.
- [x] Layout mobile permanece funcional.

## Critérios de Sucesso

- [x] Nenhuma criação usa payload legado.
- [x] Operador entende por que um título não é elegível.
- [x] Acessibilidade básica preservada.
- [x] `npm run lint` sem erros.
- [x] `npm run build` sem erros.
