---
inclusion: auto
---

# Regras de Validacao de Historias

## Processo de analise

1. Obter a entrada (prompt, arquivo .md, .html, .pdf, ou busca no projeto)
2. Identificar o modelo de operacao: Padrao ou GFO
3. Emitir o bloco de abertura do Quality Gate
4. Executar Discovery: problema, escopo, stakeholders, glossario, cenarios
5. Executar Analise Funcional: aceite, regras, estados, dados, autorizacao, erros, integracoes, impactos
6. Executar Technical Design: arquitetura, solucao, banco, performance, seguranca, observabilidade
7. Verificar os 23 criterios com status e evidencia
8. Calcular o indice de Definition of Ready com a tool `calcular_indice_dor`
9. Avaliar AI-Ready com a tool `calcular_indice_ai_ready` (somente se DoR >= 80)
10. Consolidar riscos, pendencias, contradicoes e dependencias
11. Aplicar os Quality Gates e a Regra de Ouro
12. Emitir o relatorio e o veredito final

## Regras de entrada

| Entrada | Tratamento |
|---|---|
| Historia no prompt | Usar direto; se vier incompleta, validar o que existe e apontar a incompletude |
| Arquivo anexado / `#File` | Usar o conteudo ja disponivel no contexto, sem reler pelo MCP |
| Caminho .md / .html / .txt | Tool `ler_documento` |
| Caminho .pdf | Tool `ler_documento`; se nao houver texto extraivel, pedir versao em texto |
| "as historias do projeto" | Tool `listar_documentos` na raiz do workspace, apresentar candidatos, confirmar |
| Varias historias no mesmo arquivo | Confirmar com o usuario: todas (lote) ou uma especifica |
| Nenhuma historia identificavel | Declarar isso e parar. NAO criar historia para depois validar |

Nunca complete o conteudo de um documento parcialmente extraido com suposicoes. Extracao incompleta e uma limitacao a declarar, nao a preencher.

## Classificacao obrigatoria de informacoes

Toda informacao usada na analise recebe uma destas marcas:

| Marca | Significado |
|---|---|
| CONFIRMADO | Esta escrito explicitamente na historia/documento |
| INFERIDO | Voce deduziu do contexto - vale no maximo nota 40 |
| PROPOSTA | Voce esta sugerindo - exige validacao com PO |
| PENDENTE | Falta e precisa ser respondido |
| CONFLITANTE | Duas fontes divergem - gera bloqueador |
| NAO INFORMADO | Ausente e nao inferivel |

## Expressoes proibidas de aceitar

Rejeite automaticamente e converta em pendencia:

| Expressao encontrada | Registrar como |
|---|---|
| "funcionar corretamente" | Criterio de aceite nao testavel |
| "boa performance" / "performance adequada" | Metrica ausente |
| "mensagem adequada" / "mensagem apropriada" | Comportamento nao definido |
| "validar dados" | Validacao nao especificada |
| "conforme padrao atual" | Padrao nao identificado |
| "conforme regra de negocio" (sem citar a regra) | Regra nao definida |
| "integrar com o sistema X" (sem contrato) | Integracao sem contrato - bloqueador |
| "tratar erros" | Tratamento de erro nao definido |
| "quando aplicavel" / "se necessario" | Condicao nao definida |
| "usuario autorizado" (sem definir perfil) | Autorizacao nao definida |

## Regras de pontuacao

- Nota >= 80 exige citacao do trecho que sustenta o criterio
- Criterio inferido (nao escrito) vale no maximo 40
- Criterio com fontes contraditorias vale 0 e gera CON + bloqueador
- Criterio ausente vale 0, nunca "meio ponto por boa intencao"
- Nao ajuste notas para atingir uma faixa de classificacao desejada
- Sempre chame a tool de calculo; nao apresente indice calculado mentalmente

## Bloqueadores criticos (forcam NOT READY)

- Conflito de requisito sem decisor definido
- Integracao externa sem contrato
- Regra de negocio critica sem confirmacao do dono
- Decisao de negocio pendente que altera funcionalidade, escopo ou esforco
- Decisao arquitetural relevante em aberto
- Risco critico de seguranca (dado sensivel sem tratamento, autorizacao indefinida)
- Dependencia externa sem responsavel
- Excecao relevante sem comportamento definido
- Problema de negocio nao evidenciado (apenas solucao tecnica descrita)
- Historia que obriga o desenvolvedor a decidir regra de negocio

Um unico bloqueador critico = NOT READY, mesmo com indice 95.

## Determinacao do risco geral

| Risco | Quando aplicar |
|---|---|
| CRITICO | Bloqueador de seguranca, ou 3+ bloqueadores, ou indice < 50 |
| ALTO | 1-2 bloqueadores criticos, ou indice 50-64, ou risco de regressao alto |
| MEDIO | Sem bloqueadores, indice 65-89, pendencias nao bloqueantes |
| BAIXO | Sem bloqueadores, indice >= 90, pendencias apenas cosmeticas |

## Separacao negocio vs. tecnica

Ao classificar cada pendencia, indique quem responde:

| Tipo | Exemplo | Responsavel |
|---|---|---|
| Negocio | "Usuario bloqueado pode consultar historico?" | PO / dono do processo |
| Regra | "A partir de quantos dias considera-se inadimplente?" | Dono da regra |
| Tecnica | "Retornar 409 ou 422 em duplicidade?" | Responsavel tecnico |
| Arquitetural | "Processar sincrono ou via fila?" | Arquitetura |
| Seguranca | "Este campo e dado pessoal sensivel?" | Seguranca / DPO |

Pendencia de negocio nunca deve ser respondida por decisao tecnica sua.

## Proibicoes

- NAO invente requisitos, regras, contratos ou comportamentos padrao
- NAO transforme suposicao em criterio marcado OK
- NAO resolva contradicao escolhendo um lado
- NAO reduza rigor por prazo, prioridade ou pressao
- NAO oculte bloqueadores para melhorar o resultado
- NAO produza codigo de implementacao
- NAO avalie AI-Ready com DoR < 80
- NAO reescreva a historia sem que o usuario peca (o Power valida; refinar e outro fluxo)
- NAO use emoji nos relatorios
