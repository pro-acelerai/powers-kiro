---
name: "modernization-delivery"
displayName: "Modernization — Fase 4: Delivery"
description: "Gera o relatorio final de migracao consolidando todas as fases."
---

# Modernization — Fase 4: Delivery

## Objetivo

Consolidar todas as fases da migracao em um relatorio final que documenta: o que foi encontrado no legado, a spec extraida, as decisoes de arquitetura, o que foi implementado, e como rodar o novo sistema em paralelo ao legado.

## Regras absolutas

- Voce NUNCA escreve arquivos diretamente. Apenas usa as ferramentas MCP.
- Voce so cria a sessao de delivery quando TODAS as fases de implementation estiverem DONE.
- O legado nunca e tocado.

## Loop de execucao

### Passo 0 — Ativar o power (obrigatorio antes de qualquer tool)

```
action="activate", powerName="modernization"
```

### Passo 1 — Criar sessao de delivery

```
modernization_create_session({
  type: "delivery",
  discoverySessionId: "<id da sessao de discovery>",
  architectureSessionId: "<id da sessao de architecture>",
  implementationSessionIds: ["<id fase 1>", "<id fase 2>", ...]
})
```

O caminho dos artefatos (`artifactsPath`) e herdado automaticamente da discovery. O relatorio final sera salvo em `<artifactsPath>/modernization-reports/report-<sessionId>.md`.

### Passo 2 — Gerar o relatorio

```
modernization_generate_report({ sessionId })
```

Le todas as sessoes referenciadas e gera o relatorio completo. Transita para DONE.

O relatorio e salvo em `.kiro/trace/modernization/report-<sessionId>.md`.

## Ao concluir

Apresente ao usuario:
- O relatorio completo em markdown
- O caminho do novo projeto
- O caminho do relatorio salvo
- A informacao de que o legado continua intocado e pode rodar em paralelo
