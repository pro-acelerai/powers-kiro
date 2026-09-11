---
name: "upgrade-execution"
displayName: "Upgrade — Fase 2: Execution"
description: "Aplica as mudancas do plano aprovado, valida com lint + testes e corrige ate o budget esgotar."
---

# Upgrade — Fase 2: Execution

## Pre-requisito

Esta fase so pode iniciar apos a Fase 1 (Analysis) ter transitado para `DONE` com um plano aprovado. Voce precisa do `sessionId` da sessao de analysis.

## Objetivo

Aplicar todas as mudancas do plano aprovado no projeto real, garantindo que:
1. Cada arquivo modificado esta dentro do escopo declarado
2. O lint passa sem erros
3. O comando de validacao do projeto (`validationCommand`) termina com sucesso
4. Um relatorio markdown e salvo em `artifactsPath`

## Regras absolutas

- Voce NUNCA modifica arquivos fora do escopo — o harness rejeita na hora
- Voce SEMPRE chama `apply_changes` antes de `run_validation`
- Voce NUNCA chama `submit_correction` se a validacao passou
- Voce NAO cria uma nova sessao de execution para fugir do budget — informe o usuario

## Loop de execucao

### Passo 1 — Criar a sessao de execution

```
upgrade_create_session({
  type: "execution",
  analysisSessionId: "<sessionId da analysis aprovada>"
})
```

O harness herda automaticamente: `projectPath`, `upgradeTarget`, `scope`, `validationCommand`, `artifactsPath` da sessao de analysis.

### Passo 2 — Carregar o plano aprovado

```
upgrade_read_analysis({ sessionId })
```

Retorna: todos os issues, o plano com as mudancas, e os metadados da analysis. Leia com atencao cada `change` — voce devera implementar exatamente o que foi planejado e aprovado.

### Passo 3 — Submeter as mudancas de arquivo

Para cada arquivo listado no plano, chame:

```
upgrade_submit_file_change({
  sessionId,
  file: "<caminho absoluto do arquivo>",
  operation: "modify" | "create" | "delete",
  content: "<conteudo completo e final do arquivo>",
  issueRefs: ["<id do issue>", ...],
  justification: "<por que esta mudanca resolve os issues referenciados>"
})
```

Regras:
- `content` deve ser o arquivo **inteiro**, nao um diff ou trecho
- `issueRefs` deve incluir os ids dos issues que esta mudanca resolve
- Um arquivo pode ser submetido multiplas vezes se precisar de ajustes (a ultima versao prevalece)
- Arquivos fora do `scope` serao rejeitados imediatamente pelo harness

**Sensor de cobertura de issues**: o harness verifica se todos os issues `must_fix` estao referenciados em pelo menos um `submit_file_change`. Isso gera um aviso (nao bloqueio) em `apply_changes` — corrija antes de aplicar.

### Passo 4 — Aplicar as mudancas

```
upgrade_apply_changes({ sessionId })
```

O harness:
1. Re-valida o escopo de todos os arquivos
2. Salva o conteudo original de cada arquivo (para possivel rollback manual)
3. Escreve todos os arquivos no disco
4. Emite aviso se issues `must_fix` nao foram cobertos

Em caso de falha parcial (escrita de arquivos), o harness faz rollback automatico dos arquivos ja escritos.

### Passo 5 — Executar validacao

```
upgrade_run_validation({ sessionId })
```

O harness executa em sequencia:
1. **ESLint** — com a configuracao do projeto (se existir) ou padrao embutido
2. **validationCommand** — o comando configurado na analysis (ex: `mvn verify`, `npm test`, `go test ./...`)

Resultado:
- `DONE` — lint + testes passaram. Sessao concluida com sucesso.
- `CORRECTING` — falha detectada, budget disponivel. Leia `failureEvidence`.
- `BUDGET_EXCEEDED` — 3 tentativas esgotadas. Pare e informe o usuario.

### Passo 6 — Corrigir e repetir (apenas se `CORRECTING`)

Leia `failureEvidence` retornado por `run_validation`. Cada entrada tem:
- `source`: `lint` ou `validation`
- `file` / `line` / `column` (para erros de lint)
- `rule` e `message` (para lint)
- `output` (para falhas de testes — stdout/stderr do comando)

Para cada arquivo que precisa ser corrigido:

```
upgrade_submit_file_change({
  sessionId,
  file: "<caminho absoluto>",
  operation: "modify",
  content: "<conteudo completo corrigido>",
  issueRefs: [...],
  justification: "<o que estava errado e o que foi corrigido>"
})
```

Em seguida, **volte ao Passo 4** (`apply_changes` → `run_validation`).

O harness conta cada ciclo apply+validate como uma tentativa. O budget e de **3 tentativas no total** — nao por arquivo.

### Passo 7 — Gerar relatorio

Independente do resultado (DONE ou BUDGET_EXCEEDED), gere o relatorio final:

```
upgrade_generate_report({ sessionId })
```

O harness salva um arquivo markdown em `artifactsPath` com:
- Resumo do upgrade (alvo, data, resultado)
- Lista de todos os issues com status final
- Mudancas aplicadas por arquivo
- Historico de tentativas (erros de cada ciclo)
- Resultado da validacao

## Ao concluir

**Se DONE**: informe ao usuario que o upgrade foi aplicado com sucesso, mostre o caminho do relatorio, e liste os issues `must_fix` resolvidos.

**Se BUDGET_EXCEEDED**: informe ao usuario que o budget de 3 tentativas foi esgotado. Mostre o `failureEvidence` da ultima tentativa. Sugira revisao manual dos arquivos problemáticos. Nao tente criar uma nova sessao de execution.

## Fluxo completo de estados

```
CREATED
  └─► LOADING       (create_session com type=execution)
        └─► APPLYING     (read_analysis → submit_file_change... → apply_changes)
              └─► VALIDATING  (run_validation)
                    ├─► DONE           (lint + testes passaram)
                    ├─► CORRECTING     (falha, budget disponivel → submit_file_change → apply_changes)
                    │     └─► APPLYING (novo ciclo)
                    └─► BUDGET_EXCEEDED (3 tentativas esgotadas)
```
