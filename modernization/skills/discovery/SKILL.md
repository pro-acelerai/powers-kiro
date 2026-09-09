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

### Passo 1 — Criar sessao de discovery

```
modernization_create_session({
  type: "discovery",
  legacyPath: "<caminho para o projeto legado>",
  targetStack: "<stack alvo descrita pelo usuario>",
  scope: ["<pasta ou arquivo>", ...]
})
```

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
  nonFunctional: [...],
  rawMarkdown: "<versao markdown legivel da spec completa>"
})
```

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

## Ao concluir

Informe ao usuario:
- Quantos findings foram encontrados e suas classificacoes
- Que a spec foi aprovada e esta salva
- Que o proximo passo e criar uma sessao de architecture com o `sessionId` desta sessao
