---
name: "modernization"
displayName: "Modernization"
description: "Migracao de aplicacoes legadas para stacks modernas. Reverse engineer, Spec-first, Forward build."
keywords: ["migrar", "modernizar", "legado", "legacy", "migration", "modernization", "rewrite", "stack", "refactor", "portar"]
author: "Modernization"
---

# Modernization

## Overview

Power para migrar sistemas legados para stacks modernas com controle governado.

A filosofia central: **Reverse → Spec → Forward**.

O agente nao copia codigo legado — ele extrai a intencao do sistema como uma especificacao tecnologicamente agnóstica, e reconstroi o sistema do zero a partir dessa spec na nova stack. O legado permanece intocado e o novo sistema roda em paralelo.

O processo e controlado por um Harness MCP com state machines rigidas por fase, dois gates de aprovacao humana (spec e plano), e rastreabilidade completa de cada decisao.

## When to Use This Power

Use este Power quando o usuario:

- Pedir para migrar uma aplicacao legada para uma nova stack
- Mencionar "migrar", "modernizar", "reescrever", "portar", "legado", "legacy"
- Quiser mudar o framework, linguagem ou arquitetura de um sistema existente
- Precisar de uma analise tecnica de um sistema legado antes de decidir como migrar

Nao use para implementar features novas sem migracao de sistema legado (use coding para isso).

## As 4 Fases

### Fase 1 — Discovery (skill: modernization-discovery)

Analisa o projeto legado e extrai sua especificacao.

1. Cria sessao de discovery com legacyPath e targetStack
2. Le todos os arquivos do escopo legado
3. Submete findings classificados: MIGRATE_AND_FIX, BLOCKER, DOCUMENT
4. Gate de triage humano para BLOCKERs
5. Extrai a spec (entidades, regras, fluxos, contratos)
6. Gate humano de aprovacao da spec
7. Entrega: Spec + Audit Report

### Fase 2 — Architecture (skill: modernization-architecture)

Projeta a nova arquitetura e o plano de migracao faseado.

1. Carrega a spec da Fase 1
2. Registra decisoes arquiteturais (think)
3. Submete o plano de migracao com N fases
4. Gate humano de aprovacao do plano
5. Entrega: Migration Plan com fases definidas

### Fase 3 — Implementation (skill: modernization-implementation)

Constroi o novo projeto fase por fase, a partir da spec.

1. Uma sessao por fase do plano
2. Carrega contexto da fase (spec + plano)
3. Submete arquivos do novo projeto
4. Aplica e valida com lint
5. Loop de correcao se necessario (max 3 tentativas)
6. Entrega: Novo projeto parcial, legado intocado

### Fase 4 — Delivery (skill: modernization-delivery)

Gera o relatorio final de migracao.

1. Consolida todas as sessoes
2. Gera relatorio: findings, spec, plano, resultados, lineage
3. Entrega: Migration Report + instrucoes para rodar em paralelo

## Garantias do Harness

- Nenhum arquivo do projeto legado e modificado em nenhum momento
- O novo projeto sempre e criado em diretorio separado
- Gates humanos obrigatorios antes de avancar na spec e no plano
- Backup de rastreabilidade completo em `.kiro/trace/modernization/`
- Budget de correcao controlado (max 3 tentativas por fase)
- Refinamento controlado de spec e plano (max 2 vezes cada)

## Usage

```
Migre o sistema legado em PHP em ./legacy-app para Node.js + TypeScript + Fastify.
Comece pela Fase 1 (discovery).
```

```
Analise o sistema em ./old-project e extraia a spec.
Stack alvo: Python + FastAPI + SQLAlchemy.
Escopo: src/, models/, controllers/
```
