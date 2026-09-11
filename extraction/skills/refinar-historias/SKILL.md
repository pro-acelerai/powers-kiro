---
name: refinar-historias
description: Refina e valida historias de usuario extraidas, melhorando criterios de aceite, identificando gaps e aplicando checklist INVEST.
---

# Refinar e Validar Historias de Usuario

## Quando usar

Use esta skill quando o usuario quiser:
- Refinar uma ou mais historias ja extraidas
- Validar se uma historia esta bem escrita e completa
- Melhorar criterios de aceite de uma historia
- Identificar gaps, riscos ou dependencias nao mapeadas
- Gerar cenarios de teste BDD (Dado/Quando/Entao)
- Verificar se a historia atende ao checklist INVEST

## Processo de refinamento

### 1. Receber a historia

O usuario pode:
- Colar a historia no chat
- Referenciar um arquivo com #File que contenha historias extraidas
- Pedir para refinar uma historia especifica por ID (ex: "refine a HU015")

### 2. Aplicar checklist INVEST

Avalie a historia nos 6 criterios INVEST:

| Criterio | Pergunta-chave | Status |
|---|---|---|
| **I**ndependente | Pode ser desenvolvida sem depender de outra historia em andamento? | OK / Alerta |
| **N**egociavel | O escopo pode ser ajustado sem perder o valor? | OK / Alerta |
| **V**aliosa | Entrega valor claro para o usuario ou negocio? | OK / Alerta |
| **E**stimavel | A equipe consegue estimar o esforco? | OK / Alerta |
| **S**mall (pequena) | Cabe em uma sprint? Nao e epico disfarcado? | OK / Alerta |
| **T**estavel | Os criterios de aceite sao verificaveis? | OK / Alerta |

### 3. Analisar a narrativa

Verificar:
- A persona esta correta e especifica? (nao usar "usuario" generico se da pra inferir)
- A acao esta atomica? (uma unica coisa)
- O beneficio reflete valor de negocio real? (nao apenas "para registrar")

Se houver problema, sugerir reescrita da narrativa respeitando o modelo usado (Padrao ou GFO+TJ).

### 4. Avaliar criterios de aceite

Para cada criterio existente, verificar:
- E especifico? (nao ambiguo)
- E testavel? (QA consegue verificar com passo-a-passo)
- Cobre o caminho feliz?
- Cobre pelo menos um cenario de erro/validacao?
- Cobre caso de borda relevante?

Sugerir criterios adicionais se necessario.

### 5. Identificar gaps

Buscar:
- Faltam cenarios de erro? (ex: o que acontece se o usuario informar valor negativo?)
- Faltam permissoes/perfis? (quem pode executar esta acao?)
- Faltam integracoes? (deveria notificar outro sistema?)
- Faltam validacoes mencionadas implicitamente?
- Ha regras de negocio implicitas nao documentadas?

### 6. Gerar cenarios BDD (opcional)

Se o usuario pedir, gerar cenarios no formato:

```gherkin
Cenario: [Titulo do cenario]
  Dado que [contexto/pre-condicao]
  Quando [acao executada]
  Entao [resultado esperado]
```

Gerar no minimo:
- 1 cenario de caminho feliz
- 1 cenario de validacao/erro
- 1 cenario de borda (se aplicavel)

### 7. Apresentar resultado

Formato de saida do refinamento:

```markdown
## Refinamento - [ID] - [Titulo]

### Checklist INVEST

| Criterio | Status | Observacao |
|---|---|---|
| Independente | OK | - |
| Negociavel | OK | - |
| Valiosa | OK | Valor claro para o usuario |
| Estimavel | Alerta | Complexidade da integracao nao esta clara |
| Small | OK | - |
| Testavel | OK | Criterios verificaveis |

### Narrativa

**Original:**
> [narrativa original]

**Sugestao de melhoria:**
> [narrativa reescrita]

### Criterios de Aceite - Avaliacao

| # | Criterio | Status | Sugestao |
|---|---|---|---|
| 1 | [criterio original] | Vago | [sugestao especifica] |
| 2 | [criterio original] | Muito generico | [sugestao especifica] |

### Criterios de Aceite - Versao Refinada

1. [Criterio reescrito, especifico e testavel]
2. [Criterio reescrito]
3. [Criterio novo - cenario de erro]
4. [Criterio novo - validacao]

### Regras de Negocio Identificadas

- RN01: [Regra explicita do documento]
- RN02: [Regra implicita sugerida - VALIDAR COM PO]

### Gaps Identificados

- [ ] [Gap 1 - ex: nao esta claro quem tem permissao para esta acao]
- [ ] [Gap 2 - ex: nao menciona o que acontece em caso de duplicidade]
- [ ] [Gap 3 - ex: integracao com sistema X nao detalha formato]

### Dependencias Atualizadas

- Depende de: HU003 (Cadastrar X)
- Bloqueia: HU015 (Consultar X)

### Cenarios BDD (se solicitado)

[cenarios gherkin aqui]

### Recomendacoes

- [Acao 1 para o analista/PO]
- [Acao 2 para o analista/PO]
```

## Modos de operacao

### Refinamento individual
Usuario pede: "refine a HU001"
- Aplica o processo completo na historia especifica

### Refinamento em lote
Usuario pede: "refine todas as historias do arquivo X"
- Faz um resumo rapido por historia (INVEST + gaps principais)
- Detalha apenas as que tem alertas

### Validacao rapida
Usuario pede: "valide se esta historia esta boa"
- Retorna apenas INVEST + gaps, sem reescrever tudo

### Geracao de BDD
Usuario pede: "gere cenarios de teste para HU001"
- Foca apenas na geracao de cenarios Gherkin

## Regras importantes

- NAO aprovar automaticamente - sempre apontar pelo menos 1 ponto de melhoria
- Regras de negocio SUGERIDAS (nao extraidas do documento) devem ser marcadas com "VALIDAR COM PO"
- Gaps sao PERGUNTAS para o analista, nao afirmacoes
- O refinamento e um dialogo - encoraje o usuario a responder e iterar
- Manter rastreabilidade com o documento original
- Respeitar o modelo escolhido (Padrao ou GFO+TJ) ao sugerir reescrita de narrativa
