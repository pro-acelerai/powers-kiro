---
name: "modernization-architecture"
displayName: "Modernization — Fase 2: Architecture"
description: "Propos a nova arquitetura e define o plano de migracao faseado."
---

# Modernization — Fase 2: Architecture

## Objetivo

Com base na spec extraida na Fase 1, projetar a nova arquitetura e definir um plano de migracao faseado. Cada fase do plano se tornara uma sessao de implementacao independente.

## Regras absolutas

- Voce NUNCA escreve arquivos diretamente. Apenas usa as ferramentas MCP.
- Voce SEMPRE usa o `discoverySessionId` de uma sessao de discovery com status DONE.
- Voce SEMPRE espera a resposta do usuario antes de chamar `request_plan_approval`.
- O plano deve ser faseado — cada fase e uma entrega coesa e independente.
- O novo projeto NUNCA e criado dentro do diretorio do legado.

## Loop de execucao

### Passo 0 — Ativar o power (obrigatorio antes de qualquer tool)

```
action="activate", powerName="modernization"
```

### Passo 1 — Criar sessao de architecture

```
modernization_create_session({
  type: "architecture",
  discoverySessionId: "<id da sessao de discovery DONE>"
})
```

O caminho dos artefatos (`artifactsPath`) e herdado automaticamente da sessao de discovery — voce nao precisa (nem pode) redefini-lo aqui. O novo projeto sera criado dentro desse caminho.

### Passo 2 — Carregar contexto da discovery

```
modernization_read_discovery({ sessionId })
```

Retorna a spec completa (entidades, regras, fluxos, contratos) e o resumo dos findings.
Leia com atencao antes de planejar.

### Passo 3 — Registrar raciocinio de arquitetura (use quantas vezes precisar)

```
modernization_submit_think({
  sessionId,
  phase: "architecture decision",
  reasoning: "<trade-offs considerados e decisao tomada>"
})
```

Use para documentar cada decisao arquitetural relevante antes de submeter o plano.

### Passo 4 — Submeter o plano de migracao

```
modernization_submit_migration_plan({
  sessionId,
  targetStack: "<stack completa: linguagem + framework + ORM + banco + etc>",
  newProjectName: "<nome simples do diretorio do novo projeto, ex: my-app-modern>",
  architectureDecisions: [
    "<decisao 1 com justificativa>",
    "<decisao 2 com justificativa>",
    ...
  ],
  phases: [
    {
      number: 1,
      title: "<titulo da fase>",
      description: "<o que esta fase constroi>",
      targetModule: "<modulo ou camada: domain, api, auth, ...>",
      dependencies: [],
      estimatedComplexity: "low" | "medium" | "high"
    },
    ...
  ],
  rawMarkdown: "<versao markdown legivel do plano completo>"
})
```

`newProjectName` deve ser um nome de diretorio simples (nao um caminho absoluto). O novo projeto sera criado dentro do `artifactsPath` herdado da discovery — ou seja, em `<artifactsPath>/<newProjectName>`.

**Criterios para definicao de fases:**
- Cada fase e uma entrega coesa — modulo, camada ou funcionalidade completa
- O app (mesmo parcial) deve funcionar ao final de cada fase
- Dependencias entre fases devem ser explicitas
- Comece pelas fundacoes (domain, infra) antes das camadas superiores (api, ui)

### Passo 5 — Apresentar plano ao usuario e aguardar

Apresente o `rawMarkdown` do plano. Aguarde aprovacao ou feedback.

### Passo 6 — Registrar decisao de aprovacao

```
modernization_request_plan_approval({
  sessionId,
  approved: true | false,
  notes: "<feedback do usuario>"
})
```

- Se aprovado: sessao DONE. Retorna os IDs e titulos das fases.
- Se rejeitado: volta para PLANNING. Revise e re-submeta (max 2 vezes).

## Ao concluir

Informe ao usuario:
- Numero de fases definidas com seus titulos e complexidades
- Onde o novo projeto sera criado
- Que o proximo passo e criar N sessoes de implementation (uma por fase) usando os phase IDs retornados
