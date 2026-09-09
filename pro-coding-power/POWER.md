---
name: "pro-coding"
displayName: "Pro Coding"
description: "Codificacao com IA governada a partir de historias de usuario. Agent thinks, Harness controls, Graph explains."
keywords: ["user story", "historia de usuario", "implementar historia", "implement story", "feature", "us-", "coding", "harness", "lint", "escopo"]
author: "Pro Coding"
---

# Pro Coding

## Overview

Power para implementar historias de usuario com controle governado — o agente raciocina e propoe, o Harness valida cada passo, e o desenvolvedor aprova antes de qualquer alteracao ser escrita no disco.

O loop de controle segue um grafo de estados rigido: nenhuma ferramenta pode ser chamada fora de ordem. Isso garante rastreabilidade completa de cada decisao tomada durante a implementacao.

## When to Use This Power

Use este Power quando o usuario:

- Pedir para implementar uma historia de usuario
- Mencionar "US-", "HU", "historia", "feature" seguida de uma descricao funcional
- Quiser que a IA faca alteracoes em arquivos dentro de um escopo controlado
- Precisar de rastreabilidade das decisoes de implementacao
- Quiser revisao humana antes de qualquer escrita no disco

Nao use para tarefas gerais de coding sem uma historia de usuario definida, code review avulso, ou perguntas de duvida tecnica.

## Funcionalidades

### 1. Loop de Implementacao Governado (skill: implement-story)

Implementa uma historia de usuario em 8 passos controlados pelo Harness:

1. **Criar sessao** — registra a historia e o escopo de arquivos autorizados
2. **Ler escopo** — le todos os arquivos declarados (unica janela de acesso ao codigo)
3. **Submeter plano** — raciocinio permanente gravado no grafo de rastreabilidade
4. **Propor mudancas** — uma chamada por arquivo, com justificativa por mudanca
5. **Aprovacao humana** — o desenvolvedor ve e aprova ou rejeita antes de qualquer escrita
6. **Aplicar mudancas** — Harness valida escopo e grava com backup automatico
7. **Rodar lint** — ESLint com config do projeto ou config padrao embutida
8. **Corrigir** — ciclo de correcao com budget de tentativas controlado pelo Harness

### Garantias do Harness

- Nenhum arquivo fora do escopo declarado pode ser modificado
- `apply_changes` so executa apos `request_human_approval` retornar `APPROVED`
- Backup automatico de cada arquivo antes de sobrescrever
- Trace completo salvo em `.kiro/trace/` ao final da sessao

## Usage

1. Informe a historia de usuario (texto direto ou caminho para arquivo)
2. Declare o escopo — pastas ou arquivos que o agente pode ler e modificar
3. O Power executa o loop completo, pausando para sua aprovacao no passo 5
4. Apos aprovacao, aplica as mudancas e roda o lint automaticamente

Exemplo de ativacao:

```
Implemente a US-042: como usuario quero exportar relatorio em PDF.
Escopo: src/reports/, src/utils/pdf.ts
```

## Best Practices

- Declare o escopo com granularidade adequada — pastas para features novas, arquivos especificos para alteracoes pontuais
- Leia o plano proposto no passo 3 antes de aprovar no passo 5
- Se rejeitar, informe o motivo — o agente nao abre nova sessao sem instrucao explicita
- Historias grandes podem ser divididas em sessoes menores por modulo
