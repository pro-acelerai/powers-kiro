---
name: "modernization-implementation"
displayName: "Modernization — Fase 3: Implementation"
description: "Constroi uma fase do novo projeto a partir da especificacao. Legado nunca e tocado."
---

# Modernization — Fase 3: Implementation

## Objetivo

Implementar uma fase do plano de migracao construindo o novo projeto do zero, a partir da especificacao. O codigo legado nunca e tocado. O novo projeto roda em paralelo ao legado.

## Regras absolutas

- Voce NUNCA modifica arquivos do projeto legado.
- Voce NUNCA escreve arquivos diretamente. Apenas usa as ferramentas MCP.
- Voce constroi a partir da SPEC, nao copiando codigo legado.
- Cada fase tem budget de 3 tentativas (correction loop). Nao desperdice tentativas.
- Voce NUNCA cria uma nova sessao para escapar do budget.

## Loop de execucao

### Passo 0 — Ativar o power (obrigatorio antes de qualquer tool)

```
action="activate", powerName="modernization"
```

### Passo 1 — Criar sessao de implementation para a fase

```
modernization_create_session({
  type: "implementation",
  discoverySessionId: "<id da sessao de discovery>",
  architectureSessionId: "<id da sessao de architecture>",
  phaseId: "<id da fase do plano>",
  phaseNumber: <numero da fase>,
  phaseTitle: "<titulo da fase>",
  newProjectName: "<nome do diretorio do novo projeto>"
})
```

### Passo 2 — Carregar contexto da fase

```
modernization_read_phase_context({ sessionId })
```

Retorna: spec completa, plano de migracao, detalhes da fase atual, lista de MIGRATE_AND_FIX para corrigir no novo sistema.

Leia com atencao. Entenda o que esta fase deve construir antes de propor qualquer arquivo.

### Passo 3 — Registrar raciocinio de implementacao

```
modernization_submit_think({
  sessionId,
  phase: "implementation planning",
  reasoning: "<como voce vai implementar esta fase, quais arquivos serao criados e por que>"
})
```

### Passo 4 — Submeter arquivos do novo projeto (um por chamada)

```
modernization_submit_new_file({
  sessionId,
  file: "<caminho relativo ao novo projeto, ex: src/domain/user.ts>",
  operation: "create",
  content: "<conteudo completo do arquivo>",
  justification: "<por que este arquivo existe e quais itens da spec ele implementa>",
  specRefs: ["<id de regra ou entidade da spec>", ...]
})
```

Submeta um arquivo por chamada. Voce pode submeter quantos arquivos forem necessarios.

### Passo 5 — Aplicar o novo projeto

```
modernization_apply_new_project({ sessionId })
```

Escreve todos os arquivos submetidos no diretorio do novo projeto. Transita para APPLYING.

### Passo 6 — Rodar lint

```
modernization_run_lint({ sessionId })
```

- Se lint passar: sessao transita para DONE. Fase concluida.
- Se lint falhar: transita para CORRECTING. Corrija os erros.

### Passo 7 — Correction loop (se necessario)

Se lint falhar:

```
modernization_submit_correction({ sessionId })
```

Em seguida, submeta apenas os arquivos com erros corrigidos via `submit_new_file`, depois chame `apply_new_project` e `run_lint` novamente.

Budget: 3 tentativas totais. Use com precisao.

## Ao concluir

Informe ao usuario:
- Que a fase foi concluida com lint passando
- Quantos arquivos foram criados e em qual diretorio
- Que o proximo passo e criar a sessao de implementation para a proxima fase, ou a sessao de delivery se todas as fases estiverem prontas
