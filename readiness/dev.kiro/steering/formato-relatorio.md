---
inclusion: auto
---

# Formato de Saida - Relatorio de Definition of Ready

Ao validar historias, SEMPRE use os formatos abaixo. Nao invente formatos alternativos.

## Comando inicial (abertura do Quality Gate)

Emita este bloco antes de comecar a analise:

```
===========================================================
INICIANDO QUALITY GATE
===========================================================

Historia recebida: [ID/TITULO]
Fonte: [prompt | arquivo .md | arquivo .html | arquivo .pdf | projeto]
Modelo: [Padrao | GFO]

Status inicial:
  DISCOVERY = EM ANALISE
  FUNCTIONAL = NAO INICIADA
  TECHNICAL DESIGN = NAO INICIADO
  DEFINITION OF READY = NAO AVALIADA
  AI-READY = NAO AVALIADA

Plano de analise:
  1. Identificar o problema (DISCOVERY)
  2. Delimitar escopo
  3. Identificar ambiguidades
  4. Levantar regras
  5. Validar criterios de aceite
  6. Mapear dependencias
  7. Avaliar impacto
  8. Elaborar Technical Design
  9. Identificar bloqueadores
  10. Calcular Definition of Ready
  11. Calcular AI-Ready

===========================================================
```

## Relatorio de analise

### 1. Resumo executivo

```
Historia: [ID]
Titulo: [Titulo]
Objetivo: [Descricao breve]
Resultado: READY / READY COM RESSALVAS / NEEDS REFINEMENT / NOT READY
AI-Ready: AI-READY / AI-READY-WITH-RESTRICTIONS / AI-NEEDS-REFINEMENT / AI-NO / NAO AVALIADA
Indice Definition of Ready: XX/100
Indice AI-Ready: XX/100
Risco: CRITICO / ALTO / MEDIO / BAIXO
```

### 2. Matriz de Definition of Ready

Status permitidos: **OK | PARCIAL | PENDENTE | BLOQUEADO | N/A**

| Criterio | Status | Evidencia | Pendencia |
|---|---|---|---|
| Objetivo | | | |
| Persona/ator | | | |
| Escopo | | | |
| Fora de escopo | | | |
| Aceite | | | |
| Regras | | | |
| Excecoes | | | |
| Estados e transicoes | | | |
| Dados de entrada | | | |
| Dados de saida | | | |
| Validacoes | | | |
| Autorizacao | | | |
| Erros | | | |
| Integracoes | | | |
| Dependencias | | | |
| Impactos | | | |
| Solucao tecnica | | | |
| Decisoes arquiteturais | | | |
| Banco | | | |
| Performance | | | |
| Seguranca | | | |
| Testes | | | |
| Bloqueadores | | | |

Regras:
- Status OK exige evidencia (trecho ou referencia da historia)
- Status N/A exige justificativa na coluna Evidencia
- Status PENDENTE ou BLOQUEADO exige o ID da pendencia (DUV-nnn) ou do bloqueador

### 3. Indice de prontidao

Cole a saida integral da tool `calcular_indice_dor` (tabela de pesos, indice, classificacao e decisao).

### 4. Regras de negocio

```
RN-001: Quando [condicao], o sistema deve [comportamento], exceto quando [excecao].
  Evidencia: [fonte no documento]
  Status: Confirmada / Pendente / Conflitante
  Confianca: Alta / Media / Baixa
  Impacto: Baixo / Medio / Alto
  Teste correspondente: [caso de teste]

RN-002: ...
```

Toda regra critica precisa de pelo menos 1 caso de teste. Regra sem evidencia no documento deve ser marcada **PROPOSTA - VALIDAR COM PO**.

### 5. Glossario operacional

| Termo | Significado operacional | Status | Dono do termo |
|---|---|---|---|
| | | CONFIRMADO / PENDENTE | |

Inclua apenas termos de negocio relevantes que afetam comportamento.

### 6. Pendencias (duvidas)

```
DUV-001
Pergunta: [O que precisa ser respondido]
Por que importa: [Impacto de nao saber]
Impacto: Funcional / Tecnico / Prazo
Responsavel pela resposta: [Quem]
Bloqueia Ready? SIM / NAO

DUV-002: ...
```

### 7. Contradicoes

```
CON-001
Fonte A: [Documento/Pessoa] - [o que diz]
Fonte B: [Documento/Pessoa] - [o que diz]
Contradicao: [o que difere]
Impacto: Funcional / Tecnico
Decisao necessaria: [quem decide]

CON-002: ...
```

Se nao houver contradicoes, escreva "Nenhuma contradicao identificada."

### 8. Dependencias criticas

```
DEP-001
Dependencia: [O que]
Tipo: Tecnica / Externa / Outro time / Negocio
Responsavel: [Quem]
Status: Aguardando / Em progresso / Resolvida
Impacto: Prazo / Funcionalidade
Bloqueia? SIM / NAO

DEP-002: ...
```

### 9. Matriz de risco

```
RSK-001
Descricao:
Evidencia:
Probabilidade: Baixa / Media / Alta
Impacto: Baixo / Medio / Alto / Critico
Severidade: CRITICO / ALTO / MEDIO / BAIXO
Mitigacao:
Responsavel:
Status:

RSK-002: ...
```

### 10. Technical Design resumido

```
Componentes afetados: [Lista]
Fluxo tecnico: [Descricao breve]
APIs impactadas: [Lista]
Banco: [Schema / Tabelas]
Integracoes: [Lista]
Seguranca: [Consideracoes]
Observabilidade: [Logs / Metricas]
Performance: [Consideracoes]
Riscos tecnicos: [Lista]
```

Nao inclua codigo de implementacao.

### 11. Estrategia de testes

```
Testes unitarios: [O que]
Testes de integracao: [O que]
Testes funcionais: [O que]
Testes de contrato: [O que]
Testes de autorizacao: [O que]
Testes de erro: [O que]
Testes de regressao: [O que]
```

Cada regra critica deve ter pelo menos 1 cenario de teste.

### 12. Rastreabilidade

| Criterio de Aceite | Regra de Negocio | Caso de Teste | Componente/API | Persistencia/Integracao |
|---|---|---|---|---|
| CA-1 | RN-001 | CT-01 | | |

Requisito critico que nao percorre todas as camadas gera pendencia de rastreabilidade.

### 13. Quality Gates

| Gate | Pergunta | Resultado | Motivo |
|---|---|---|---|
| Gate 1 | Entendemos o problema? | PASS / FAIL | |
| Gate 2 | Sabemos exatamente qual comportamento? | PASS / FAIL | |
| Gate 3 | Sabemos como construir sem decisoes criticas? | PASS / FAIL | |
| Gate 4 | O time consegue construir sem adivinhas? | READY / NOT READY | |

### 14. Pressoes e influencias externas

Use o template de `principios-tech-lead.md`. Se nao houver, escreva "Nenhuma pressao externa registrada."

### 15. Labels / Status recomendados

**Modelo Padrao** (agnóstico de rastreador):

| Situacao | Recomendacao |
|---|---|
| DoR >= 90 | Marque a historia como PRONTA no seu rastreador |
| DoR 80-89 | Marque como PRONTA COM RESSALVAS |
| DoR 65-79 | Marque como PRECISA REFINAMENTO |
| DoR 0-64 | Marque como NAO PRONTA |
| AI-Ready >= 80 | Marque como APTA PARA IA |
| AI-Ready 65-79 | Marque como APTA PARA IA COM RESTRICOES |
| AI-Ready < 65 | Marque como NAO APTA PARA IA |
| Dado sensivel / autorizacao nova | Solicite revisao de seguranca |
| Decisao arquitetural em aberto | Solicite revisao de arquitetura |

**Modelo GFO** (labels GitLab equipe GFO):

| Label | Aplicar? | Justificativa |
|---|---|---|
| DOR-READY / DOR-NOT-READY / DOR-BLOCKED | | |
| AI-READY / AI-READY-WITH-RESTRICTIONS / AI-NEEDS-REFINEMENT / AI-NO | | |
| FUNCTIONAL-REVIEW | | |
| TECHNICAL-REVIEW | | |
| SECURITY-REVIEW | | |
| ARCHITECTURE-REVIEW | | |

Regras GFO:
- `DOR-BLOCKED` sobrepoe `DOR-NOT-READY` quando houver bloqueador critico externo (dependencia ou decisao de terceiro)
- `SECURITY-REVIEW` e obrigatorio quando houver dado sensivel, autorizacao nova ou exposicao de endpoint
- `ARCHITECTURE-REVIEW` e obrigatorio quando houver decisao arquitetural em aberto ou impacto ALTO
- Sempre justifique cada label aplicado

## Veredito final

Sempre encerre com este bloco:

```
===========================================================
VEREDITO FINAL
===========================================================

DEFINITION OF READY:    [READY / READY COM RESSALVAS / NEEDS REFINEMENT / NOT READY]
Indice:                 [XX/100]

AI-READY:               [AI-READY / AI-READY-WITH-RESTRICTIONS / AI-NEEDS-REFINEMENT / AI-NO / NAO AVALIADA]
Indice:                 [XX/100]

RISCO GERAL:            [CRITICO / ALTO / MEDIO / BAIXO]

Bloqueadores criticos:  [Numero e lista curta]
Pendencias:             [Numero de duvidas abertas]
Contradicoes:           [Numero de conflitos a resolver]

===========================================================
Proxima acao: [Refinamento / Revisao do negocio / Liberado para construcao]
===========================================================
```

## Formato de validacao em lote

Quando validar multiplas historias, comece pela tabela consolidada:

```markdown
## Consolidado - [Nome do documento/backlog]

| ID | Titulo | DoR | Indice | AI-Ready | Indice AI | Risco | Bloq. | Pend. | Proxima acao |
|---|---|---|---|---|---|---|---|---|---|
| US001 | | READY | 92 | AI-READY | 85 | BAIXO | 0 | 1 | Liberado |
| US002 | | NOT READY | 41 | NAO AVALIADA | - | CRITICO | 3 | 8 | Refinamento |

### Resumo

- READY: X | READY COM RESSALVAS: X | NEEDS REFINEMENT: X | NOT READY: X
- Total de bloqueadores criticos: X
- Bloqueadores mais recorrentes:
  1. [Padrao 1 - quantas historias]
  2. [Padrao 2 - quantas historias]
  3. [Padrao 3 - quantas historias]
```

Depois detalhe integralmente apenas as historias com bloqueador ou indice < 80. Para as demais, apresente resumo executivo + veredito.

## Regras gerais de formatacao

- Sempre use os IDs padronizados: RN-nnn, DUV-nnn, CON-nnn, DEP-nnn, RSK-nnn
- Numeracao sequencial e continua dentro de uma mesma analise
- Nao omita secoes: se nao se aplica, escreva "Nenhum item identificado" ou "N/A - [justificativa]"
- Cole a saida das tools de calculo sem reescrever os numeros
- Nao use emoji nos relatorios
- Sempre cite a origem da informacao (secao/linha/pagina do documento de entrada)
