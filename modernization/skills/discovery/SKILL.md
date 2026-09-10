---
name: "modernization-discovery"
displayName: "Modernization — Fase 1: Discovery"
description: "Analisa o sistema legado, classifica problemas e extrai a especificacao do sistema."
---

# Modernization — Fase 1: Discovery

## Objetivo

Analisar o sistema legado para produzir dois artefatos:
1. **Audit report** — lista classificada de todos os problemas encontrados
2. **Specification** — descricao do que o sistema FAZ, independente de como foi implementado

A spec e o unico artefato que passa para as proximas fases. O codigo legado nao e copiado.

## Regras absolutas

- Voce NUNCA escreve arquivos diretamente. Apenas usa as ferramentas MCP.
- Voce NUNCA avanca para submit_specification sem antes passar pelo triage gate.
- Voce SEMPRE espera a resposta do usuario antes de chamar `request_spec_approval`.
- A spec captura a INTENCAO do sistema, nao a implementacao. Bugs nao entram na spec.

## Loop de execucao

### Passo 0 — Ativar o power (obrigatorio antes de qualquer tool)

Antes de chamar qualquer tool `modernization_*`, ative o power:

```
action="activate", powerName="modernization"
```

Se receber erro dizendo que a tool nao existe ou que e necessario ativar, execute este passo primeiro.

### Passo 1 — Definir o caminho dos artefatos e criar a sessao de discovery

Antes de criar a sessao, defina onde TODOS os artefatos desta iteracao serao salvos
(relatorio HTML, relatorio final e o novo projeto):

1. **Sugira um caminho** dentro do workspace atual do usuario. Uma boa sugestao padrao
   e uma pasta dedicada na raiz do workspace, por exemplo `./modernization` ou
   `./<nome-do-projeto>-modernization`.
2. **Pergunte ao usuario** se aquele caminho e o ideal para salvar todos os artefatos
   desta iteracao. Aguarde a confirmacao (ou um caminho alternativo) antes de continuar.

O caminho confirmado (`artifactsPath`) e definido uma unica vez aqui e sera **herdado
automaticamente** por todas as fases seguintes (architecture, implementation, delivery).
Deve ser um caminho dentro do workspace.

```
modernization_create_session({
  type: "discovery",
  legacyPath: "<caminho para o projeto legado>",
  targetStack: "<stack alvo descrita pelo usuario>",
  scope: ["<pasta ou arquivo>", ...],
  artifactsPath: "<caminho confirmado pelo usuario, relativo ao workspace>"
})
```

Se o usuario nao especificar um caminho, omita `artifactsPath` — o padrao e a raiz do workspace.

### Passo 2 — Ler o codigo legado

```
modernization_read_legacy({ sessionId })
```

Retorna o conteudo de todos os arquivos no escopo. Leia com atencao antes de continuar.

### Passo 3 — Registrar raciocinio (use quantas vezes precisar)

```
modernization_submit_think({
  sessionId,
  phase: "legacy analysis",
  reasoning: "<o que voce observou e como esta classificando>"
})
```

Use antes de cada grupo de findings para documentar seu raciocinio.

### Passo 4 — Submeter findings (um por problema)

```
modernization_submit_finding({
  sessionId,
  file: "<arquivo onde foi encontrado>",
  line: <numero da linha ou omitir>,
  classification: "MIGRATE_AND_FIX" | "BLOCKER" | "DOCUMENT",
  severity: "critical" | "high" | "medium" | "low" | "info",
  title: "<titulo curto>",
  description: "<descricao completa do problema>",
  recommendation: "<o que deve ser feito>"
})
```

**Classificacao:**
- `MIGRATE_AND_FIX` — problema no codigo, nao na intencao. O novo sistema nasce correto (ex: SQL injection, deps vulneraveis, bad practices).
- `BLOCKER` — problema que afeta o entendimento do que o sistema deveria fazer. Exige decisao humana antes de continuar.
- `DOCUMENT` — problema fora do escopo desta migracao. Apenas documenta.

Submeta um finding por problema encontrado. Nao agrupe.

### Passo 5 — Solicitar triage

```
modernization_request_triage({ sessionId })
```

- Se nao houver BLOCKERs: avanca automaticamente para SPECIFYING.
- Se houver BLOCKERs: retorna a lista. **Apresente-a ao usuario e aguarde as decisoes antes de continuar.**

### Passo 6 — Submeter decisoes de triage (somente se houver BLOCKERs)

Apos o usuario decidir por cada BLOCKER:

```
modernization_submit_triage_decisions({
  sessionId,
  decisions: [
    {
      findingId: "<id do finding>",
      resolution: "fix_before" | "descope" | "accept_risk",
      notes: "<notas da decisao humana>"
    }
  ]
})
```

### Passo 7 — Registrar raciocinio da spec

```
modernization_submit_think({
  sessionId,
  phase: "spec extraction",
  reasoning: "<como voce vai mapear o legado para a spec>"
})
```

### Passo 8 — Submeter a especificacao

```
modernization_submit_specification({
  sessionId,
  domainEntities: [...],
  businessRules: [...],
  flows: [...],
  externalContracts: [...],
  databaseRules: [...],   // triggers, stored procedures, scheduled jobs, views, functions
  excludedScope: [...],   // modulos/arquivos fora do escopo, com motivo
  nonFunctional: [...],
  rawMarkdown: "<versao markdown legivel da spec completa>"
})
```

**databaseRules** — Para cada objeto de banco encontrado (trigger, procedure, job, view, function), registre:
- `id`, `name`, `type`, `description` (em termos de negocio)
- `decision`: `migrate` | `reimplement_in_application` | `drop` | `keep_as_is`
- `rationale`: justificativa da decisao
- `sourceRef`: onde foi encontrado

**excludedScope** — Para cada modulo ou arquivo fora do escopo da migracao, registre:
- `path`: caminho do modulo/arquivo
- `reason`: por que esta excluido

Se o sistema legado nao tiver logica no banco e nao houver escopo excluido, passe arrays vazios.

A spec deve capturar o QUE o sistema faz, nao COMO. Nao mencione nomes de funcoes, classes ou arquivos do legado na spec.

### Passo 9 — Apresentar spec ao usuario e aguardar

Apresente o `rawMarkdown` da spec ao usuario. Aguarde sua resposta (aprovado ou rejeitado com feedback).

### Passo 10 — Registrar decisao de aprovacao

```
modernization_request_spec_approval({
  sessionId,
  approved: true | false,
  notes: "<feedback do usuario>"
})
```

- Se aprovado: sessao transita para DONE. Discovery completo.
- Se rejeitado: volta para SPECIFYING. Corrija e re-submeta (max 2 vezes).

### Passo 11 — Gerar relatorio HTML (somente apos aprovacao)

```
modernization_generate_discovery_html({ sessionId })
```

Gera um relatorio HTML self-contained em `<artifactsPath>/modernization-reports/discovery-{sessionId}.html` com abas de resumo, findings, especificacao e raciocinio. Informe ao usuario o caminho do arquivo gerado.

## Ao concluir

Informe ao usuario:
- Quantos findings foram encontrados e suas classificacoes
- Que a spec foi aprovada e esta salva
- O caminho do relatorio HTML gerado
- Que o proximo passo e criar uma sessao de architecture com o `sessionId` desta sessao
