---
name: "extraction"
displayName: "Extraction"
description: "Extrai e refina historias de usuario a partir de documentos de visao geral, seguindo padroes de granularidade CRUD e formato padronizado com narrativa, criterios de aceite e regras de negocio."
keywords: ["historias de usuario", "user stories", "extrair historias", "backlog", "HU", "HT", "historia tecnica", "visao geral", "planilha", "modulo", "refinar historia", "criterios de aceite", "INVEST", "BDD"]
author: "pro-acelerai"
---

# Extraction

## Overview

Power para extrair e refinar historias de usuario (HU) e historias tecnicas (HT) a partir de planilhas de visao geral ou texto. Segue padroes de granularidade CRUD e gera historias completas com narrativa, criterios de aceite testaveis, regras de negocio e referencias cruzadas entre historias.

## Modelos disponiveis

Ao iniciar, o usuario escolhe o modelo que define formato de narrativa e campos especificos:

| Modelo | Descricao |
|---|---|
| **Padrao** | Narrativa "Eu como... quero... para que...", campo "Integracoes Internas", agnostico de dominio |
| **GFO + TJ** | Campo "Integracoes GFO" + narrativa "A fim de... precisa-se..." (formato Tribunal de Justica), criterios como "Resultados esperados", sem linguagem tecnica |
| **SIMADE** | Campo "Integracoes SIMADE" + narrativa com multiplos atores e codigos SSC, criterios com sub-numeracao decimal (1, 1.1, 1.2...), secao "Informacoes Complementares" e versionamento com historico de evolucao |

As regras de granularidade, classificacao HU/HT e numeracao sao identicas nos tres modelos.

## When to Use This Power

Use este Power quando o usuario:

- Pedir para extrair historias de usuario de uma planilha Excel
- Mencionar backlog, HU, HT, ou historias de usuario
- Quiser converter um documento de visao geral em historias formatadas
- Pedir para gerar historias a partir de texto descritivo de funcionalidades
- Quiser refinar, validar ou melhorar uma historia ja escrita
- Pedir cenarios de teste BDD para uma historia
- Mencionar checklist INVEST ou qualidade de historias

Nao use para tarefas gerais de desenvolvimento, code review, ou perguntas que nao envolvam historias de usuario.

## Funcionalidades

### 1. Extracao de Historias (skill: extrair-historias)

Converte documentos de visao geral em historias completas com:
- Narrativa (formato definido pelo modelo escolhido)
- Campos estruturados (tipo, prioridade, complexidade, integracoes, dependencias)
- Criterios de aceite especificos e testaveis (3-5 por historia)
- Regras de negocio (quando mencionadas no documento)
- Referencias cruzadas entre historias (dependencias)
- Tabela resumo por macro etapa

### 2. Refinamento e Validacao (skill: refinar-historias)

Analisa historias ja extraidas e oferece:
- Checklist INVEST (Independente, Negociavel, Valiosa, Estimavel, Small, Testavel)
- Melhoria da narrativa e criterios de aceite
- Identificacao de gaps (cenarios de erro, permissoes, validacoes faltantes)
- Geracao de cenarios BDD (Dado/Quando/Entao)
- Sugestoes de regras de negocio (marcadas para validacao com PO)
- Atualizacao de dependencias

## Usage

### Extracao

1. Escolha o modelo: **Padrao**, **GFO + TJ** ou **SIMADE**
2. Forneca o documento (planilha Excel via `ler_planilha`, texto colado, ou #File)
3. O Power analisa, identifica funcionalidades e gera historias atomicas
4. Cada historia recebe narrativa, campos, criterios e dependencias
5. Resultado pode ser exportado em Markdown ou Excel (caminho sugerido: `.kiro/extraction/`)

### Refinamento

1. Forneca a historia a refinar (colar, #File, ou indicar por ID)
2. O Power aplica INVEST, analisa criterios e identifica gaps
3. Retorna versao refinada com sugestoes e perguntas para o PO
4. O analista itera ate a historia estar completa

Modos disponiveis:
- "Refine a HU001" → refinamento individual completo
- "Refine todas as historias" → resumo em lote com alertas
- "Valide esta historia" → checklist rapido INVEST + gaps
- "Gere cenarios BDD para HU001" → apenas cenarios Gherkin

## Best Practices

- Cada historia = UMA unica acao atomica
- "Exportar PDF" e "Exportar Excel" sao SEMPRE historias separadas
- Inferir personas do contexto do documento
- Prioridade/Complexidade: preencher quando o documento der indicios, "A definir" quando nao
- Regras de negocio: extrair APENAS as mencionadas no documento
- No refinamento: sempre apontar pelo menos 1 melhoria
- Regras sugeridas (nao do documento) devem ser marcadas "VALIDAR COM PO"
- Gaps sao perguntas para o analista, nao afirmacoes
