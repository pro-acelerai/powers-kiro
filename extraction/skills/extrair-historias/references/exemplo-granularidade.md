# Referencia de Granularidade - Exemplos

## Padrao de Verbos para Titulos

| Verbo | Quando usar | Exemplo |
|---|---|---|
| Cadastrar | Criar novo registro | Cadastrar previsao de receita |
| Consultar | Visualizar dados existentes | Consultar lancamentos |
| Editar | Alterar registro existente | Editar previsao de receita |
| Excluir | Remover/inativar registro | Excluir previsao de receita |
| Cancelar | Tornar sem efeito (com justificativa) | Cancelar solicitacao administrativa |
| Filtrar | Aplicar criterios de busca | Filtrar lancamentos por periodo |
| Exportar | Gerar arquivo para download | Exportar lancamentos para PDF |
| Importar | Carregar dados de arquivo externo | Importar planilha de referencia |
| Gerar | Criar documento/relatorio | Gerar relatorio mensal |
| Visualizar | Ver painel/grafico | Visualizar painel de visao geral |
| Processar | Executar rotina sobre dados | Processar arquivo de retorno bancario |
| Registrar | Gravar informacao (geralmente contabil) | Registrar liquidacao no sistema financeiro |
| Conciliar | Cruzar informacoes de fontes diferentes | Conciliar extrato com movimentacao interna |
| Controlar | Acompanhar/gerenciar um fluxo | Controlar transferencias recebidas |
| Criar versao | Gerar nova versao de registro periodico | Criar nova versao da previsao anual |
| Comparar | Contrastar versoes ou periodos | Comparar versoes da previsao |
| Atualizar | Recalcular valores com base em indice | Atualizar tabelas com novo indice de referencia |

## Exemplos de Quebra

### Exemplo 1 - Consulta com filtros e exportacao

Funcionalidade original:
> "Funcionalidade para consulta do lancamento, que permita visualizar de acordo com a chave escolhida (codigo, nome, documento). Filtros de multipla escolha e exportacao para PDF/Excel"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU054 | HU | Consultar lancamentos |
| HU055 | HU | Filtrar lancamentos |
| HU056 | HU | Exportar lancamentos para PDF |
| HU057 | HU | Exportar lancamentos para Excel |

**Regra aplicada:** Consulta + Filtro + Exportar PDF + Exportar Excel = minimo 4 historias SEMPRE.

### Exemplo 2 - Funcionalidade com integracao

Funcionalidade original:
> "Registrar no sistema financeiro as informacoes contabeis validadas pelo usuario no sistema de gestao"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU068 | HU | Registrar credito no sistema financeiro |
| HU069 | HU | Preparar dados para registro manual no sistema financeiro |
| HU070 | HU | Emitir comprovante de registro patrimonial |
| HT011 | HT | Integrar registro de credito automaticamente ao sistema financeiro |

### Exemplo 3 - Importacao de fontes diferentes

Funcionalidade original:
> "Atualizacao do indice de referencia a partir de planilha enviada pelo Orgao A (formato da Lei) e planilha enviada pelo Orgao B (consolidada)"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU022 | HU | Importar planilha do Orgao A (formato da Lei) |
| HU023 | HU | Importar planilha do Orgao B (consolidada) |

**Regra aplicada:** Fontes diferentes = historias de importacao SEPARADAS. Nunca agrupar "Importar planilhas" genericamente.

### Exemplo 4 - Processo automatico com multiplas etapas

Funcionalidade original:
> "Verificar automaticamente atualizacoes no valor do indice de referencia e atualizar o sistema"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HT001 | HT | Verificar automaticamente atualizacoes no valor do indice de referencia |
| HT002 | HT | Notificar usuario sobre nova publicacao do indice |
| HT003 | HT | Atualizar valor do indice automaticamente apos validacao |

**Regra aplicada:** Processo automatico = decompor em etapas atomicas. "Verificar + notificar + atualizar" sao 3 HTs, NUNCA 1 unica HT.

### Exemplo 5 - Atualizacao periodica (versionamento)

Funcionalidade original:
> "Ferramenta que permita a atualizacao da previsao das entradas de recurso no fluxo de forma periodica"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU013 | HU | Criar nova versao da previsao de receita |
| HU014 | HU | Consultar versoes anteriores da previsao |
| HU015 | HU | Comparar versoes da previsao |

**Regra aplicada:** "Atualizacao periodica" implica versionamento → criar versao + consultar versoes + comparar versoes = 3 historias.

### Exemplo 6 - Formatos de saida diferentes

Funcionalidade original:
> "Elaborar tabelas atualizadas em dois formatos distintos: formato legal (itens separados) e formato de publicacao no portal (itens agrupados)"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU024 | HU | Atualizar tabelas com novos valores calculados |
| HU025 | HU | Gerar tabela no formato legal |
| HU026 | HU | Gerar tabela no formato de publicacao no portal |
| HU027 | HU | Exportar tabela para publicacao |

**Regra aplicada:** Formatos diferentes = historias separadas. Atualizar valores (recalcular) e separado de gerar. Exportar para publicacao e separado de gerar.

## Diferenciacao HU vs HT

### HU - O usuario FAZ algo:
- Cadastrar novo valor → analista abre tela, digita, salva
- Consultar execucao → analista acessa painel, ve dados
- Exportar para PDF → analista clica botao de exportar
- Importar planilha → analista faz upload de arquivo

### HT - O sistema FAZ sozinho:
- Verificar atualizacoes automaticamente → rotina automatica consulta fonte
- Notificar usuario sobre mudanca → sistema envia alerta
- Atualizar valor automaticamente → sistema grava apos validacao
- Integrar dados a sistemas externos → chamada automatica via integracao
- Sinalizar registros desatualizados → sistema detecta e alerta
