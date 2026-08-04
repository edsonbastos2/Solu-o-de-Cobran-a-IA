---
name: cy-fix-reviews
description: Executa remediação de revisão de PR agnóstica de provedor usando arquivos de rodada de revisão existentes em ../ppov-docs/issues/front/<ticket>-<nome>/reviews-NNN/. Use ao resolver problemas de revisão em lote, atualizar arquivos markdown de problemas, implementar correções e verificar o resultado. Não use para execução de tarefas de PRD, exportação/busca de revisões ou tarefas genéricas de código sem arquivos de problema de revisão.
---

# Corrigir Revisões

Execute o fluxo de trabalho de remediação de revisão em sequência estrita. Os arquivos de revisão já existem e definem o escopo completo para a execução.

## Entradas Necessárias

- Os arquivos de problema com escopo listados em `<batch_issue_files>`.
- O diretório de rodada de revisão do PRD e o frontmatter dos arquivos de problema.
- O fluxo de trabalho de verificação do repositório requerido por `cy-final-verify`.

## Fluxo de Trabalho

1. Coletar contexto da rodada.
   - Ler o frontmatter dos arquivos de problema com escopo para entender o provedor, número da rodada e status/severidade do problema. Se múltiplos arquivos de problema estiverem no escopo, verificar se seus valores de `provider`, `pr`, `round` e `round_created_at` concordam.
   - Ler `<batch_scope>` para identificar o nome do PRD, rodada de revisão, arquivos de código no escopo e flags condicionais como auto-commit.

2. Ler e triar os arquivos de problema com escopo.
   - Ler todos os arquivos de problema listados completamente antes de editar código.
   - Atualizar o `status` do frontmatter de cada arquivo de problema de `pending` para `valid` ou `invalid`.
   - Registrar justificativa técnica concreta em `## Triagem`: declarar por que o problema é válido ou inválido, identificar a causa raiz se válido, e delinear a abordagem de correção pretendida.

3. Corrigir problemas válidos completamente.
   - Corrigir problemas em ordem de severidade: crítico primeiro, depois alto, médio, baixo. Isso garante que as correções de maior impacto ocorram mesmo se o lote for interrompido.
   - Implementar correções de qualidade de produção para cada problema `valid` no escopo.
   - Adicionar ou atualizar testes quando o comportamento muda ou regressões são possíveis. Edições em arquivos de teste sempre estão no escopo quando validam uma correção.
   - Manter alterações de código restritas aos arquivos listados nos arquivos de código do `<batch_scope>`. Se uma correção absolutamente requer tocar um arquivo não listado, limitar a alteração ao mínimo necessário e documentar o porquê na seção `## Triagem` do arquivo de problema.
   - Não refatore, limpe ou melhore código não relacionado aos problemas sendo corrigidos.

4. Fechar os arquivos de problema corretamente.
   - Para um problema `valid`, definir `status: resolved` no frontmatter apenas após o código e a verificação estarem concluídos.
   - Para um problema `invalid`, documentar por que é inválido e então definir `status: resolved` uma vez que a análise esteja completa.

5. Verificar antes da conclusão.
   - Usar `cy-final-verify` antes de qualquer afirmação de conclusão ou commit automático.
   - Execute os comandos de verificação reais do repositório; não pare em verificações parciais.
   - Se a verificação falhar, corrija as verificações falhando no código que você alterou. Não reverta suas correções para passar na verificação -- encontre a causa raiz da falha e trate-a. Se a falha estiver em código pré-existente não relacionado às suas alterações, documente-a na seção `## Triagem` do arquivo de problema relevante e prossiga. Se duas correções conflitarem entre si e a verificação não puder passar após duas tentativas, documente o conflito em ambos os arquivos de problema e reporte a situação em vez de fazer loop indefinidamente.
   - Se todos os problemas no lote forem inválidos e nenhum código foi alterado, pule completamente o passo de commit -- não crie um commit vazio. Ainda execute a verificação para confirmar que não há regressões.
   - Deixe o diff pronto para revisão manual, a menos que `<batch_scope>` mostre "Commits automáticos: habilitado".

## Regras Críticas

- Não busque ou exporte revisões dentro deste fluxo de trabalho. `compozy reviews fetch` já produziu os arquivos da rodada.
- Não chame scripts específicos de provedor ou mutações do `gh`. O Compozy resolve threads de provedor após o lote ter sucesso.
- Não modifique arquivos de problema fora do lote com escopo.
- Não marque um problema como `resolved` antes que o trabalho subjacente e a verificação estejam realmente completos.
