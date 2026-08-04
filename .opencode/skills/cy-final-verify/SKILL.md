---
name: cy-final-verify
description: Exige evidências frescas de verificação antes de qualquer afirmação de conclusão, correção ou aprovação, e antes de commits ou criação de PR. Use quando um agente está prestes a reportar sucesso, entregar trabalho ou fazer commit de código. Não use para planejamento inicial, brainstorming ou tarefas que ainda não chegaram a uma etapa concreta de verificação.
---

# Verificação Antes da Conclusão

## Visão Geral

Afirmar que o trabalho está completo sem verificação é desonestidade, não eficiência.

**Princípio central:** Evidências antes de afirmações, sempre.

**Violar a letra desta regra é violar o espírito desta regra.**

## A Lei de Ferro

```
NENHUMA AFIRMAÇÃO DE CONCLUSÃO SEM EVIDÊNCIA FRESCA DE VERIFICAÇÃO
```

Se o comando de verificação não foi executado na mensagem atual, o resultado não pode ser afirmado.

## A Função Portão

```
ANTES de afirmar qualquer status ou expressar satisfação:

1. IDENTIFICAR: Qual comando prova esta afirmação?
2. EXECUTAR: Rodar o comando COMPLETO (fresco, completo)
3. LER: Saída completa, verificar código de saída, contar falhas
4. VERIFICAR: A saída confirma a afirmação?
   - Se NÃO: Declarar status real com evidências
   - Se SIM: Declarar afirmação COM evidências
5. SOMENTE ENTÃO: Fazer a afirmação

Pular qualquer passo = mentir, não verificar
```

## Escopo de Verificação

Corresponder o escopo de verificação ao escopo da afirmação:

- **Afirmação estreita** (ex.: "este teste passa"): Executar o teste específico.
- **Afirmação ampla** (ex.: "tarefa completa", "pronto para commit"): Executar o **pipeline completo de verificação** — formatação, linting, todos os testes e build. Se o projeto definir um comando único de portão (ex.: `make verify`), executá-lo.

Uma verificação estreita não suporta uma afirmação ampla. Executar `make test` sozinho não justifica "tarefa completa". Executar apenas o linter não justifica "pronto para commit". O escopo de verificação deve ser igual ou mais amplo que o escopo da afirmação.

**Em caso de dúvida, execute o pipeline completo.** Verificação excessiva desperdiça minutos. Verificação insuficiente desperdiça horas.

**Pipeline com sucesso != requisitos atendidos.** Um build verde prova que o código compila, faz lint e passa nos testes existentes. Não prova que a implementação corresponde aos requisitos. Para afirmações de "tarefa completa" ou "requisitos atendidos", também verifique os entregáveis em relação à especificação original — linha por linha, não por suposição.

## Falhas Comuns

| Afirmação             | Requer                          | Não Suficiente                |
| --------------------- | ------------------------------- | ----------------------------- |
| Testes passam         | Saída do comando: 0 falhas      | Execução anterior, "deve passar" |
| Linter limpo          | Saída do linter: 0 erros        | Verificação parcial, extrapolação |
| Build com sucesso     | Comando de build: saída 0       | Linter passou, logs parecem bons |
| Bug corrigido         | Testar sintoma original: passa  | Código alterado, assumido corrigido |
| Teste de regressão funciona | Ciclo vermelho-verde verificado | Teste passa uma vez |
| Agente concluiu       | Diff do VCS mostra alterações   | Agente reporta "sucesso" |
| Requisitos atendidos  | Checklist linha por linha       | Testes passando |

## Sinais de Alerta

- Usar "deveria", "provavelmente" ou "parece"
- Expressar satisfação antes da verificação
- Prestes a fazer commit, push ou abrir um PR sem verificação
- Confiar no relatório de sucesso de outro agente
- Depender de verificação parcial
- Pensar "só desta vez"
- Qualquer redação que implique sucesso sem evidências atuais

## Prevenção de Racionalização

| Desculpa                                | Realidade               |
| --------------------------------------- | ----------------------- |
| "Deve funcionar agora"                  | Execute a verificação   |
| "Estou confiante"                       | Confiança ≠ evidência   |
| "Só desta vez"                          | Sem exceções            |
| "Linter passou"                         | Linter ≠ compilador     |
| "Agente disse sucesso"                  | Verifique independentemente |
| "Estou cansado"                         | Cansaço ≠ desculpa      |
| "Verificação parcial é suficiente"      | Parcial não prova nada  |
| "Palavras diferentes então a regra não se aplica" | Espírito acima da letra |

## Quando Aplicar

Aplique esta skill antes de:

- qualquer afirmação de sucesso ou conclusão
- qualquer expressão de satisfação com o estado da implementação
- qualquer commit ou criação de PR
- qualquer entrega que implique correção
- avançar para a próxima tarefa com base na conclusão

## Portão Pré-Commit e Pré-PR

Commits e PRs são artefatos permanentes. Eles requerem o mais alto padrão de verificação.

**Antes de `git commit`:**
1. Execute o pipeline completo de verificação (ex.: `make verify`). Não um subconjunto. O pipeline completo.
2. Confirme zero erros, zero avisos, zero falhas de teste na saída.
3. Produza um Relatório de Verificação (veja o template abaixo) com veredicto APROVADO.
4. Somente então execute `git commit`.

**Antes de criar um PR:**
1. Tudo o acima, mais:
2. Verifique se o diff corresponde às alterações pretendidas (revisão de `git diff`).
3. Confirme que nenhum arquivo não relacionado está no stage.

Se o pipeline completo não passou nesta sessão após a última alteração de código, o commit ou PR não deve prosseguir.

## Template de Relatório de Verificação

A verificação não está completa até que o agente **cite a saída real do comando** em sua resposta. "Executei e passou" não é evidência. Se a saída da verificação não for mostrada, a verificação não aconteceu.

Toda verificação deve ser reportada usando esta estrutura. Não desvie.

```
RELATÓRIO DE VERIFICAÇÃO
------------------------
Afirmação: [O que está sendo afirmado — ex.: "testes passam", "build com sucesso", "tarefa completa"]
Comando: [Comando exato executado — ex.: `make verify`]
Executado: [Timestamp ou "agora, após todas as alterações"]
Código de saída: [0 ou diferente de zero]
Resumo da saída: [Linhas chave da saída — contagem de aprovações, contagem de erros, resultado do build]
Avisos: [Quaisquer avisos, ou "nenhum"]
Erros: [Quaisquer erros, ou "nenhum"]
Veredicto: APROVADO ou REPROVADO
```

Se o veredicto for REPROVADO, não use linguagem de conclusão. Declare o que falhou e o que resta.

Se o veredicto for APROVADO, a afirmação pode prosseguir — mas apenas a afirmação específica suportada pela evidência. "Testes passam" não significa "build com sucesso".

## Quando a Verificação Falha

Falha de verificação não é um beco sem saída. É informação. Siga este protocolo:

1. **Leia a falha.** Identifique o erro exato: qual comando falhou, qual teste, qual regra de lint, qual erro de build. Cite as linhas de saída relevantes.
2. **Diagnostique a causa raiz.** Não adivinhe. Leia a mensagem de erro. Rastreie-a até a fonte. Se múltiplas coisas falharam, trate-as uma por vez começando pela primeira falha.
3. **Corrija a causa raiz.** Aplique a alteração mínima que trata o erro real. Não aplique workarounds, suprima avisos ou pule verificações.
4. **Verifique novamente do zero.** Execute o comando completo de verificação novamente. Não assuma que a correção funcionou. Não execute apenas o subconjunto que falhou anteriormente.
5. **Reporte com evidências.** Use o Template de Relatório de Verificação. Se passou agora, a afirmação pode prosseguir. Se falhou novamente, volte ao passo 1.

**Nunca:**
- Afirme sucesso parcial ("3 de 4 verificações passam, é suficiente")
- Pule a re-verificação após uma correção ("corrigi o erro, então deve passar agora")
- Culpe a ferramenta ("o linter está errado") sem evidências de falso positivo
- Avance para a próxima tarefa enquanto a verificação ainda está falhando

Se o comando de verificação correto não estiver claro, identifique-o antes de fazer qualquer afirmação de conclusão. Se apenas verificação parcial estiver disponível, declare essa limitação explicitamente e evite linguagem de conclusão.
