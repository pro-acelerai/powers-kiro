# Criterios de Definition of Ready - Referencia

## 1. Os 23 criterios obrigatorios

Cada criterio recebe um status: **OK | PARCIAL | PENDENTE | BLOQUEADO | N/A**.
Status OK exige evidencia. Status N/A exige justificativa.

| # | Criterio | O que verificar | Critico |
|---|---|---|---|
| 1 | Objetivo de negocio claro | Problema real, nao apenas solucao tecnica | Sim |
| 2 | Persona/ator definido | Quem executa e quem se beneficia | Sim |
| 3 | Escopo delimitado | O que sera alterado | Sim |
| 4 | Fora de escopo identificado | O que explicitamente nao sera feito | Nao |
| 5 | Criterios de aceite objetivos e testaveis | QA, dev, PO e IA chegam a mesma conclusao | Sim |
| 6 | Regras de negocio criticas definidas | Condicao, comportamento, excecao, confirmadas | Sim |
| 7 | Excecoes relevantes definidas | Comportamento em cada desvio mapeado | Sim |
| 8 | Estados e transicoes definidos | Quando houver ciclo de vida | Condicional |
| 9 | Dados de entrada definidos | Campos, tipos, obrigatoriedade, formato | Sim |
| 10 | Dados de saida definidos | Retorno, payload, tela, arquivo | Sim |
| 11 | Validacoes definidas | Regra de cada campo e de cada operacao | Sim |
| 12 | Autorizacao definida | Quem pode fazer o que (distinto de autenticacao) | Sim |
| 13 | Erros relevantes definidos | Condicao -> resultado -> mensagem/codigo | Sim |
| 14 | Integracoes identificadas | Sistema, contrato, timeout, idempotencia | Sim |
| 15 | Dependencias identificadas | Tecnicas, externas, outros times, negocio | Sim |
| 16 | Impactos identificados | O que pode quebrar | Sim |
| 17 | Solucao tecnica conhecida | Caminho de implementacao viavel e descrito | Sim |
| 18 | Decisoes arquiteturais resolvidas | Nenhuma decisao relevante em aberto | Sim |
| 19 | Impacto em banco analisado | Schema, indices, migrations, volumetria | Condicional |
| 20 | Performance avaliada | Metrica objetiva quando relevante | Condicional |
| 21 | Seguranca avaliada | Dados sensiveis, OWASP, LGPD, privilegio minimo | Sim |
| 22 | Estrategia de testes possivel | Da para testar sem ambiente/dado inexistente | Sim |
| 23 | Sem bloqueadores conhecidos | Nenhum item classificado como bloqueador | Sim |

Regra: qualquer criterio **critico** em PENDENTE ou BLOQUEADO -> historia **NOT READY**.

Criterios **condicionais** (8, 19, 20) sao N/A somente quando a historia comprovadamente nao envolve ciclo de vida, persistencia ou volume/latencia relevante. A justificativa deve estar escrita no relatorio.

## 2. Pesos do indice de Definition of Ready

| Criterio ponderado | Chave da tool | Peso |
|---|---|---|
| Clareza do problema e objetivo | `clareza_problema_objetivo` | 10% |
| Clareza funcional | `clareza_funcional` | 15% |
| Criterios de aceite | `criterios_aceite` | 15% |
| Regras de negocio | `regras_negocio` | 15% |
| Dados e validacoes | `dados_validacoes` | 10% |
| Dependencias e integracoes | `dependencias_integracoes` | 10% |
| Seguranca e autorizacao | `seguranca_autorizacao` | 5% |
| Technical Design | `technical_design` | 10% |
| Testabilidade | `testabilidade` | 5% |
| **SOMA** | - | **95%** |

Formula aplicada pela tool `calcular_indice_dor`:

```
pontos = Σ (nota do criterio × peso) / 100
indice = pontos × 100 / 95
```

> **Sobre a soma dos pesos:** os pesos listados somam 95%. A pontuacao e normalizada
> para a escala 0-100, de modo que notas 100 em todos os criterios resultem em indice 100.
> A saida da tool mostra a normalizacao explicitamente. Se o time recalibrar os pesos
> para somar 100, a normalizacao deixa de ter efeito automaticamente.

Mapeamento dos 23 criterios para os criterios ponderados:

| Criterio ponderado | Cobre os itens |
|---|---|
| Clareza do problema e objetivo | 1, 2 |
| Clareza funcional | 3, 4, 7, 8 |
| Criterios de aceite | 5 |
| Regras de negocio | 6 |
| Dados e validacoes | 9, 10, 11 |
| Dependencias e integracoes | 14, 15, 16 |
| Seguranca e autorizacao | 12, 21 |
| Technical Design | 17, 18, 19, 20 |
| Testabilidade | 22 |

O item 23 (sem bloqueadores) nao entra no calculo ponderado: ele entra como `bloqueadores_criticos` na tool e sobrepoe o resultado.

## 3. Rubrica de notas (0-100)

Aplique a mesma rubrica a todos os criterios ponderados:

| Nota | Situacao |
|---|---|
| 100 | Totalmente definido, com evidencia explicita na historia, sem interpretacao necessaria |
| 80 | Definido, mas com um detalhe secundario a confirmar |
| 60 | Parcialmente definido; o dev precisaria inferir algo nao critico |
| 40 | Mencionado de forma vaga ou generica; exige interpretacao |
| 20 | Apenas indicio indireto; praticamente ausente |
| 0 | Ausente, contraditorio, ou baseado em "conforme padrao atual" sem definicao |

Regras de calibragem:

- Nota >= 80 exige que voce consiga citar o trecho da historia que sustenta o criterio
- Criterio inferido por voce (nao escrito na historia) vale no maximo 40
- Criterio com fontes contraditorias vale 0 e gera contradicao (CON) + bloqueador
- Nunca atribua nota "de cortesia" para atingir uma faixa de classificacao

## 4. Classificacao Definition of Ready

| Indice | Classificacao | Decisao |
|---|---|---|
| 90-100 | READY | Pode construir |
| 80-89 | READY COM RESSALVAS | Somente se as ressalvas forem nao-bloqueantes |
| 65-79 | NEEDS REFINEMENT | Nao iniciar construcao |
| 0-64 | NOT READY | Bloqueada |

Regra critica: **um bloqueador critico = NOT READY**, independentemente do indice.

## 5. O que conta como bloqueador critico

- Conflito de requisito entre fontes/stakeholders sem decisor definido
- Integracao com sistema externo sem contrato definido
- Regra de negocio critica sem confirmacao do dono da regra
- Decisao de negocio pendente que altera funcionalidade, esforco ou escopo
- Decisao arquitetural relevante em aberto
- Risco critico de seguranca (dado sensivel sem tratamento, autorizacao indefinida)
- Dependencia externa sem responsavel identificado
- Excecao relevante sem comportamento definido
- Problema de negocio nao evidenciado (historia descreve apenas solucao tecnica)
- Historia que exige que o desenvolvedor decida regra de negocio

## 6. Pesos do indice AI-Ready

Avaliado somente quando o DoR for >= 80.

| Criterio | Chave da tool | Peso |
|---|---|---|
| Clareza e determinismo | `clareza_determinismo` | 25% |
| Padroes conhecidos / implementacoes similares | `padroes_conhecidos` | 15% |
| Complexidade contida | `complexidade_contida` | 15% |
| Risco de regressao baixo | `risco_regressao_baixo` | 15% |
| Cobertura de testes existente | `cobertura_testes` | 10% |
| Exemplos e estabilidade de contratos | `exemplos_contratos_estaveis` | 10% |
| Facilidade de validacao automatica | `validacao_automatica` | 10% |
| **TOTAL** | - | **100%** |

`complexidade_contida` e `risco_regressao_baixo` sao notas de **favorabilidade**: quanto menor a complexidade ou o risco real, maior a nota.

| Indice | Classificacao | Execucao |
|---|---|---|
| 80-100 | AI-READY | Recomendada |
| 65-79 | AI-READY-WITH-RESTRICTIONS | Apos ajustes |
| 40-64 | AI-NEEDS-REFINEMENT | Nao recomendada |
| 0-39 | AI-NO | Fluxo convencional |

Os limites das secoes 4 e 6 podem ser recalibrados pelo time. Para recalibrar, ajuste os thresholds em `mcp-server/server.py` nas funcoes `_classificar_dor` e `_classificar_ai`.

## 7. Labels / Status recomendados

### Modelo Padrao (agnóstico de rastreador)

Use o nome de status que fizer sentido no rastreador do seu time. Sugestoes:

| Resultado DoR | Sugestao de status |
|---|---|
| READY | PRONTA / READY / APROVADA |
| READY COM RESSALVAS | PRONTA COM RESSALVAS |
| NEEDS REFINEMENT | PRECISA REFINAMENTO |
| NOT READY | NAO PRONTA / BLOQUEADA |

| Resultado AI-Ready | Sugestao de status |
|---|---|
| AI-READY | APTA PARA IA |
| AI-READY-WITH-RESTRICTIONS | APTA PARA IA COM RESTRICOES |
| AI-NEEDS-REFINEMENT | NAO APTA PARA IA (refinar) |
| AI-NO | NAO APTA PARA IA |

Revisoes adicionais sugeridas quando aplicavel:
- Revisao de seguranca (dado sensivel, autorizacao nova, endpoint exposto)
- Revisao de arquitetura (decisao arquitetural em aberto ou impacto ALTO)
- Revisao funcional (regra de negocio nao confirmada pelo PO)
- Revisao tecnica (solucao tecnica nao validada pelo time)

### Modelo GFO (labels GitLab equipe GFO)

**Definition of Ready:** `DOR-READY` | `DOR-NOT-READY` | `DOR-BLOCKED`

**AI-Ready:** `AI-READY` | `AI-READY-WITH-RESTRICTIONS` | `AI-NEEDS-REFINEMENT` | `AI-NO`

**Revisoes adicionais:** `FUNCTIONAL-REVIEW` | `TECHNICAL-REVIEW` | `SECURITY-REVIEW` | `ARCHITECTURE-REVIEW`

Regras de aplicacao GFO:
- `DOR-BLOCKED` sobrepoe `DOR-NOT-READY` quando houver bloqueador critico externo (dependencia ou decisao de terceiro)
- `SECURITY-REVIEW` e obrigatorio quando houver dado sensivel, autorizacao nova ou exposicao de endpoint
- `ARCHITECTURE-REVIEW` e obrigatorio quando houver decisao arquitetural em aberto ou impacto ALTO
- Sempre justifique cada label aplicado
