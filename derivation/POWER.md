---
name: "derivation"
displayName: "Derivation"
description: "Deriva o Anexo Tecnico a partir de uma historia de usuario: identifica lacunas tecnicas, gera lista de perguntas por responsavel e produz o documento tecnico completo para o desenvolvedor."
keywords: ["anexo tecnico", "derivar anexo", "lacunas tecnicas", "mapeamento de dados", "contrato de integracao", "campos de entrada", "campos de retorno", "regras de validacao", "persistencia", "codigos HTTP", "logs", "graylog", "mock", "cenarios de teste", "historias tecnicas", "HT", "HU", "derivacao tecnica"]
author: "pro-acelerai"
---

# Derivation

## Overview

Power que atua como **Analista Tecnico Senior** na ponte entre o requisito de negocio e a implementacao. Recebe uma historia (HU ou HT) ja refinada com o PO e identifica tudo que falta para que um desenvolvedor possa implementa-la sem adivinhas.

O fluxo e obrigatoriamente em duas fases:

1. **Levantar Lacunas** — lê a historia, identifica os gaps tecnicas e gera uma lista de perguntas categorizadas por responsavel (Lider Tecnico, DBA, PO/Negocio, Analista). O Analista coleta as respostas com os stakeholders corretos e preenche o documento.

2. **Derivar Anexo** — com a historia original e as respostas preenchidas, gera o Anexo Tecnico completo, seguindo o template padrao, com secoes condicionais conforme o tipo de historia.

O Anexo Tecnico e de uso exclusivo do desenvolvedor. A historia (HU/HT) permanece como artefato do negocio/cliente.

## When to Use This Power

Use este Power quando:

- Uma historia passou pelo pre-refinamento com PO e area de negocio e precisa de detalhamento tecnico
- O desenvolvedor precisar do mapeamento de campos, contratos de integracao, regras de validacao e cenarios de teste
- O Analista precisar de um roteiro estruturado de perguntas para levar ao Lider Tecnico, DBA e PO
- A historia precisar do Anexo Tecnico antes de entrar no Agente Validador

Nao use para extrair ou refinar historias novas (use o power `extraction`), nem para validar a prontidao da historia (use o power `readiness`).

## Entradas aceitas

| Entrada | Como fornecer |
|---|---|
| Historia colada no chat | Escrever ou colar o texto direto no prompt |
| Arquivo Markdown | Anexar no chat, referenciar com `#File` ou informar o caminho |
| Historia + lista de lacunas respondidas | Informar ambos os arquivos na Fase 2 |

## Funcionalidades

### 1. Levantamento de Lacunas (skill: levantar-lacunas)

- Analisa a historia e identifica todos os gaps tecnicos: campos sem mapeamento, regras sem especificacao, integracoes sem contrato, persistencias sem destino, erros sem tratamento
- Gera lista de perguntas especificas e contextualizadas, agrupadas por responsavel:
  - **Lider Tecnico** — contratos HTTP, padroes de log, HTs de referencia, mock existente
  - **DBA / Desenvolvedor** — tabelas, colunas, tipos, schema existente ou novo
  - **PO / Negocio** — dominios, obrigatoriedades, valores padrao, regras de negocio
  - **Analista (pode responder sozinho)** — HTs relacionadas, integracoes existentes, convencoes do projeto
- Cada pergunta tem um espaco `> **Resposta:** _(a preencher)_` para o Analista completar
- Exporta para `.kiro/derivation/[ID]-lacunas.md`

### 2. Geracao do Anexo Tecnico (skill: derivar-anexo)

Recebe a historia original e o arquivo de lacunas respondidas e gera o Anexo Tecnico completo com secoes condicionais:

| # | Secao | Quando incluir |
|---|---|---|
| 1 | Objetivo | Sempre |
| 2 | Contexto da integracao (fluxo numerado) | Sempre |
| 3 | Campos enviados — tabela + detalhe por campo | Se a historia envia dados a sistema externo |
| 4 | Campos recebidos — tabela + detalhe por campo | Se a historia recebe dados de sistema externo |
| 5 | Regras de validacao do retorno | Se ha campos recebidos |
| 6 | Regra de persistencia (sucesso / inconsistencia) | Se ha persistencia de dados |
| 7 | Tratamento dos codigos HTTP | Se ha integracao HTTP |
| 8 | Logs e Graylog | Sempre |
| 9 | Chamada previa (preservacao) | Se existe chamada anterior que nao muda |
| 10 | Simulacao / Mock | Se endpoint real nao esta disponivel |
| 11 | Cenarios minimos para teste | Sempre |
| 12 | Mapeamento consolidado | Se ha campos enviados e/ou recebidos |
| 13 | Consideracoes para implementacao | Sempre |
| 14 | Referencias | Se ha HTs relacionadas |

- Exporta para `.kiro/derivation/[ID]-anexo-tecnico.md`

## Usage

### Fase 1 — Levantar Lacunas

1. Forneca a historia (HU ou HT) — colada no chat, `#File`, ou caminho do arquivo
2. Use a skill `levantar-lacunas`
3. O agente analisa a historia e gera a lista de perguntas por categoria
4. Salve o arquivo em `.kiro/derivation/[ID]-lacunas.md`
5. O Analista preenche as respostas consultando Lider Tecnico, DBA, PO etc.

### Fase 2 — Derivar Anexo

1. Forneca a historia original + o arquivo de lacunas respondidas
2. Use a skill `derivar-anexo`
3. O agente gera o Anexo Tecnico completo com as secoes aplicaveis
4. Salve o arquivo em `.kiro/derivation/[ID]-anexo-tecnico.md`

## Best Practices

- NAO invente mapeamentos de dados, contratos ou regras que nao foram informados nas respostas
- Toda lacuna nao respondida deve gerar uma nota `[PENDENTE — aguardando resposta]` no AT, nunca uma suposicao
- Campos sem dominio definido devem aparecer como `A definir` na tabela
- O AT deve ser especifico o suficiente para o desenvolvedor nao precisar voltar ao Analista
- O AT nunca deve conter linguagem de negocio para o cliente — e documento interno tecnico
- Cenarios de teste devem cobrir obrigatoriamente: sucesso, campo ausente, campo fora do formato e erro de integracao
