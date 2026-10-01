---
name: avaliar-ai-ready
description: Avalia se uma historia e apta para execucao por IA, calculando o indice AI-Ready e recomendando powers e agentes. Exige Definition of Ready >= 80 como pre-condicao.
---

# Avaliar AI-Readiness

## Quando usar

Use esta skill quando o usuario quiser:
- Saber se uma historia pode ser implementada por IA
- Obter o indice AI-Ready e a classificacao
- Descobrir quais powers/agentes aplicar na execucao
- Entender por que uma historia pronta para o time nao e apta para IA

## Pre-condicao obrigatoria

**Somente historias com Definition of Ready >= 80 podem ser avaliadas para IA.**

Se o DoR ainda nao foi calculado, execute primeiro a skill `validar-historia`.
Se o DoR for < 80, responda:

```
AI-READY: NAO AVALIADA
Motivo: exige Definition of Ready >= 80 (atual: XX/100)
Proxima acao: refinar a historia e recalcular o Definition of Ready
```

Nao contorne essa regra, mesmo que o usuario peca apenas a avaliacao de IA.

## Processo

### 1. Avaliar os 7 criterios

| Criterio | Chave | Peso | O que investigar |
|---|---|---|---|
| Clareza e determinismo | `clareza_determinismo` | 25% | A IA consegue implementar sem interpretar intencao? Existe exatamente um resultado correto? |
| Padroes conhecidos | `padroes_conhecidos` | 15% | Existe implementacao similar no repositorio para servir de referencia? |
| Complexidade contida | `complexidade_contida` | 15% | Quantos arquivos, modulos e sistemas sao afetados? (favorabilidade: menos = nota maior) |
| Risco de regressao baixo | `risco_regressao_baixo` | 15% | Toca codigo critico/legado? Quantos consumidores dependem? (favorabilidade) |
| Cobertura de testes | `cobertura_testes` | 10% | Existem testes que detectariam uma quebra introduzida pela IA? |
| Exemplos e contratos estaveis | `exemplos_contratos_estaveis` | 10% | Ha exemplos de entrada/saida? Os contratos mudam com frequencia? |
| Validacao automatica | `validacao_automatica` | 10% | O resultado pode ser verificado por build/teste/lint sem inspecao manual extensa? |

Use a rubrica de notas de `../validar-historia/references/criterios-dor.md` (secao 3), adaptada:
- 100 = condicao ideal para execucao por IA
- 0 = condicao proibitiva

Atencao: `complexidade_contida` e `risco_regressao_baixo` sao **favorabilidade**. Complexidade alta -> nota baixa.

### 2. Calcular o indice

Chame a tool `calcular_indice_ai_ready` passando `scores` (os 7 criterios) e `indice_dor`.
Nao calcule mentalmente.

### 3. Interpretar a classificacao

| Indice | Classificacao | Execucao |
|---|---|---|
| 80-100 | AI-READY | Recomendada |
| 65-79 | AI-READY-WITH-RESTRICTIONS | Apos os ajustes indicados |
| 40-64 | AI-NEEDS-REFINEMENT | Nao recomendada |
| 0-39 | AI-NO | Fluxo convencional |

Para AI-READY-WITH-RESTRICTIONS, liste explicitamente **quais** ajustes destravam a execucao (ex: "adicionar testes de regressao no modulo X antes de delegar").

### 4. Recomendar powers e agentes

Selecione apenas o que a historia realmente exige, com justificativa:

**Powers:** Backend, Frontend, API, Database, QA, Security, DevOps, Performance, Integration, Code Review

**Agentes:** Development, QA, Code Review, Security Review, Architecture Review, Database Review

Regras:
- Historia com dado sensivel ou autorizacao nova -> incluir Security / Security Review
- Historia com alteracao de schema -> incluir Database / Database Review
- Historia com integracao externa -> incluir Integration
- Toda historia delegada a IA -> incluir Code Review

### 5. Emitir o resultado

```markdown
## Avaliacao AI-Ready - [ID] - [Titulo]

**Pre-condicao:** Definition of Ready = XX/100 (>= 80 OK)

| Criterio | Peso | Nota | Justificativa |
|---|---|---|---|
| Clareza e determinismo | 25% | XX | [evidencia] |
| Padroes conhecidos | 15% | XX | [evidencia] |
| Complexidade contida | 15% | XX | [arquivos/sistemas afetados] |
| Risco de regressao baixo | 15% | XX | [consumidores/criticidade] |
| Cobertura de testes | 10% | XX | [estado atual dos testes] |
| Exemplos e contratos estaveis | 10% | XX | [evidencia] |
| Validacao automatica | 10% | XX | [como validar] |

**Indice AI-Ready:** XX/100
**Classificacao:** [AI-READY / AI-READY-WITH-RESTRICTIONS / AI-NEEDS-REFINEMENT / AI-NO]

### Restricoes de execucao
- [Restricao 1, se houver]

### Ajustes que elevariam o indice
- [Ajuste 1]

### Powers recomendados
- [Power]: [por que]

### Agentes recomendados
- [Agente]: [por que]

### Riscos especificos de execucao por IA
- [Risco de alucinacao / interpretacao / regressao]

**Status recomendado:** AI-READY (ou equivalente conforme modelo escolhido)
```

## Riscos especificos a sempre investigar

- **Risco de alucinacao**: a historia tem lacuna que a IA preencheria inventando comportamento?
- **Risco de interpretacao**: existe mais de uma implementacao "razoavel" com resultados diferentes?
- **Risco de regressao silenciosa**: a quebra apareceria apenas em producao?
- **Risco de contrato**: a IA usaria uma versao desatualizada do contrato de integracao?
- **Risco de escopo**: a IA tenderia a "melhorar" codigo adjacente nao solicitado?

Se qualquer um desses riscos for alto, o indice AI-Ready nao pode ficar acima de 64, mesmo com os outros criterios altos.

## Regras importantes

- DoR < 80 -> NAO AVALIADA. Sem excecao
- Nao rebaixe o Definition of Ready por causa do AI-Ready, nem o contrario: sao indices independentes
- "READY para o time" + "AI-NO" e um resultado valido e esperado
- Frases como "a IA consegue descobrir" ou "a IA resolve" sao registradas como **RISCO DE ALUCINACAO**, nunca aceitas como argumento
- Sempre indique o que precisaria mudar para elevar o indice
- Nao produza codigo de implementacao nesta avaliacao
