---
name: "upgrade-analysis"
displayName: "Upgrade — Fase 1: Analysis"
description: "Escaneia o projeto, identifica issues de upgrade e produz um plano de mudancas para aprovacao humana."
---

# Upgrade — Fase 1: Analysis

## Objetivo

Produzir dois artefatos:
1. **Issues** — lista classificada de tudo que precisa mudar para atingir o alvo de upgrade
2. **Plano** — conjunto de mudancas concretas (por arquivo) com referencias aos issues, aprovado pelo usuario

O plano aprovado e o unico artefato que passa para a Fase 2 (Execution). Voce nao escreve codigo aqui.

## Regras absolutas

- Voce NUNCA modifica arquivos diretamente. Apenas usa as ferramentas MCP.
- Voce SEMPRE espera a resposta do usuario antes de chamar `upgrade_request_plan_approval`.
- Issues de status `must_fix` sao obrigatorios: o plano deve cobri-los.
- O plano nao altera logica de negocio — apenas adapta a plataforma/versao/dependencias.

## Loop de execucao

### Passo 0 — Ativar o power

```
action="activate", powerName="upgrade"
```

### Passo 1 — Definir artifactsPath e criar a sessao de analysis

Antes de criar a sessao, pergunte ao usuario:
- Qual e o alvo do upgrade (ex: "Node 18 → 22", "Spring Boot 2 → 3", "CVE remediation")
- Qual comando de validacao usar (ex: `npm test`, `mvn verify`, `go test ./...`)
- Onde salvar os artefatos desta iteracao

Sugira um caminho absoluto como `<workspace>/upgrade-artifacts` e aguarde confirmacao.

```
upgrade_create_session({
  type: "analysis",
  projectPath: "<caminho absoluto para a raiz do projeto>",
  upgradeTarget: "<descricao do alvo, ex: 'Node 18 → 22 + dependencias major'>",
  scope: ["<pasta ou arquivo>", ...],
  validationCommand: "<comando de build/teste, ex: 'npm test'>",
  artifactsPath: "<caminho ABSOLUTO confirmado pelo usuario>"
})
```

`scope`: subpastas ou arquivos a analisar. Se omitido, usa o projeto inteiro.

### Passo 2 — Ler o projeto

```
upgrade_read_project({ sessionId })
```

Retorna o conteudo de todos os arquivos no escopo. Leia com atencao antes de continuar.

### Passo 3 — Registrar raciocinio (use quantas vezes precisar)

```
upgrade_submit_think({
  sessionId,
  phase: "scan",
  reasoning: "<o que voce observou sobre o projeto e o alvo de upgrade>"
})
```

### Passo 4 — Submeter issues (um por problema)

```
upgrade_submit_issue({
  sessionId,
  file: "<arquivo onde o problema foi encontrado>",
  line: <numero de linha ou omitir>,
  type: "breaking_api" | "deprecated_usage" | "cve" | "syntax_idiom" | "toolchain" | "incompatible_dep",
  severity: "critical" | "high" | "medium" | "low",
  status: "must_fix" | "recommended" | "optional",
  title: "<titulo curto>",
  description: "<o que e o problema e por que existe>",
  recommendation: "<o que deve ser feito para resolver>"
})
```

**Tipos de issue:**
- `breaking_api` — API removida ou incompativel na versao alvo
- `deprecated_usage` — uso de algo ainda funcional mas marcado deprecated
- `cve` — vulnerabilidade de seguranca conhecida
- `syntax_idiom` — padrao de codigo que pode usar recurso moderno disponivel na versao alvo
- `toolchain` — build tool, config ou test runner desatualizado
- `incompatible_dep` — dependencia que nao suporta a versao alvo

**Status:**
- `must_fix` — bloqueia o upgrade; obrigatorio no plano
- `recommended` — melhora significativa; deve estar no plano se possivel
- `optional` — melhoria de qualidade; inclua se nao adicionar risco

Submeta um issue por problema encontrado. Nao agrupe.

### Passo 5 — Registrar raciocinio do plano

```
upgrade_submit_think({
  sessionId,
  phase: "planning",
  reasoning: "<como voce vai mapear os issues para mudancas concretas>"
})
```

### Passo 6 — Submeter o plano

```
upgrade_submit_plan({
  sessionId,
  upgradeTarget: "<descricao do alvo>",
  reasoning: "<justificativa das escolhas e ordem das mudancas>",
  changes: [
    {
      file: "<caminho do arquivo a modificar>",
      description: "<o que muda neste arquivo e por que>",
      issueRefs: ["<id do issue>", ...],
      riskLevel: "low" | "medium" | "high"
    }
  ],
  rawMarkdown: "<versao markdown legivel do plano completo>"
})
```

Cada `change` deve referenciar pelo menos um issue via `issueRefs`.
Todos os issues `must_fix` devem ter ao menos um change que os referencia.

### Passo 7 — Apresentar o plano ao usuario e aguardar

Apresente o `rawMarkdown` do plano. Destaque:
- Issues `must_fix` e como cada um sera resolvido
- Arquivos que serao modificados e o risco de cada mudanca
- O comando de validacao que sera executado

Aguarde a resposta do usuario (aprovado ou rejeitado com feedback).

### Passo 8 — Registrar decisao de aprovacao

```
upgrade_request_plan_approval({
  sessionId,
  approved: true | false,
  notes: "<feedback do usuario>"
})
```

- Se aprovado: sessao transita para DONE. Analysis completa.
- Se rejeitado: volta para SCANNING. Revise os issues e o plano (max 2 refinamentos).

## Ao concluir

Informe ao usuario:
- Quantos issues foram encontrados por tipo e status
- Que o plano foi aprovado e esta salvo
- O `sessionId` desta sessao — sera necessario para criar a sessao de execution
- Que o proximo passo e invocar o skill `upgrade-execution`
