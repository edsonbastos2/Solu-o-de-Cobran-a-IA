# Bloco VALIDAÇÃO — verificação manual (sempre)

Este projeto **não possui suite de testes automatizados**. A validação é feita via
verificação manual e comandos de build/lint.

> Para detalhes adicionais sobre padrões de teste futuros, ver skill `test-generator`.

## Checklist de verificação da tabela

### Compilação e lint

```bash
# Verificar TypeScript
npx tsc --noEmit

# Verificar ESLint
npm run lint

# Build completo
npm run build
```

### Verificações funcionais (executar em `npm run dev`)

- [ ] Tabela renderiza com dados reais da API
- [ ] Estado de loading: mensagem "Carregando..." visível enquanto carrega
- [ ] Estado de erro: mensagem de erro visível (simular parando o backend)
- [ ] Estado vazio: "Nenhum registro encontrado" quando API retorna array vazio
- [ ] Paginação: trocar de página carrega os dados corretos
- [ ] Paginação: botão "Anterior" desabilitado na página 1
- [ ] Paginação: botão "Próximo" desabilitado na última página
- [ ] Busca: digitar no campo de busca filtra resultados
- [ ] Busca: limpar campo de busca restaura a lista completa
- [ ] Filtros por coluna: cada coluna filtrável funciona independentemente
- [ ] Filtros combinados: múltiplos filtros aplicados simultaneamente
- [ ] Criar registro: abrir modal, preencher, salvar → registro aparece na lista
- [ ] Editar registro: clicar em editar, alterar, salvar → lista atualizada
- [ ] Deletar registro: confirmar exclusão → registro some da lista
- [ ] Deletar registro: cancelar no confirm não remove o registro
- [ ] Modal criar: campos iniciam vazios
- [ ] Modal editar: campos iniciam com dados do registro
- [ ] Modal: validação de campos obrigatórios impede submit
- [ ] Modal: mensagem de erro ao falhar salvamento
- [ ] Modal: fecha ao clicar em Cancelar
- [ ] Modal: fecha ao clicar no X
- [ ] Responsividade: testar em 375px, 768px, 1280px
- [ ] Responsividade: tabela com scroll horizontal em mobile (`overflow-x-auto`)
- [ ] Responsividade: filtros empilham em mobile, alinham em desktop

### Verificações de segurança multi-tenant

- [ ] Lista só mostra registros do usuário logado (não de outros tenants)
- [ ] Criar registro associa `user_id` automaticamente (não é enviado pelo cliente)
- [ ] Editar registro de outro tenant retorna erro
- [ ] Deletar registro de outro tenant retorna erro
- [ ] Não é possível acessar registro de outro tenant via URL direta

### Verificações de acessibilidade

- [ ] Tabela usa `<thead>` e `<tbody>` corretamente
- [ ] Botões têm `title` ou texto acessível
- [ ] Inputs têm `placeholder` ou `<label>`
- [ ] Cores de texto têm contraste suficiente no fundo escuro
- [ ] Ícones de ação (editar/remover) são distinguíveis por cor e forma

## Estrutura de verificação por bloco

| Bloco presente | Verificações extras |
|---|---|
| Modal | Criar: validação de campos obrigatórios, feedback de erro. Editar: dados preenchidos corretamente ao abrir. Botão Salvar disabled durante submit |
| Filtro header | Limpar filtros reseta busca. Mudar filtro → requisição com params corretos. Combinação de filtros. Reset de página ao filtrar |
| Filtro coluna | Cada coluna filtrável funciona independentemente. Limpar filtro por coluna. Filtros preservados ao trocar de página |
| Paginação | Última página correta. Navegação sequencial. Voltar à página 1 ao filtrar. Indicador de página atual |
| Ordenação | Clicar header alterna asc/desc. Seta indicadora visível. Ordenação persiste ao trocar de página. Reset ao mudar ordenação |

## Regras (anti-padrões a evitar)

- **Nunca** pular a verificação de build (`npm run build`) antes de declarar concluído
- **Nunca** esquecer de verificar o estado de loading e erro (são os bugs mais comuns)
- **Nunca** assumir que funciona em mobile sem testar (responsividade é obrigatória)
- **Sempre** testar com o backend real (não com dados mockados mentalmente)
- **Sempre** verificar multi-tenant: criar como usuário A, logar como usuário B, confirmar que A não vê dados de B e vice-versa
- **Sempre** abrir o modal tanto para criar quanto para editar (paths diferentes)
