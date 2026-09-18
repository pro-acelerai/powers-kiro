---
description: Instrucoes para gerar versao HTML do relatorio de validacao produzido pelo power Readiness
inclusion: manual
---

# Geracao de HTML — Readiness

Quando o usuario pedir uma versao `.html` do relatorio de validacao (`.kiro/readiness/[ID]-relatorio.md`), use `prodemge-template.html` (neste mesmo diretorio `dev.kiro/steering/`) como base de design.

## Como gerar o HTML

1. Leia `prodemge-template.html` para ter acesso ao CSS completo e todos os componentes
2. Crie um novo arquivo `.html` a partir do template — **nunca modifique o template**
3. Preencha os placeholders `<!-- ... -->` com os dados do relatorio

## Componentes a usar neste power

### Header
- `.header-badge`: `"Readiness · Quality Gate"` (ou `"Readiness · GFO"` no modelo GFO)

### Hero
- `.hero-eyebrow`: `"Relatório de Validação · [ID DA HISTÓRIA]"`
- `.hero h1`: título da história com `<span>` no ID (ex: `"<span>HT1252</span> — Integração SICOMP"`)
- `.hero-tagline`: breve descrição da história
- `.hero-meta`: modelo (Padrão/GFO), se AT foi fornecido, data, DoR index

### Veredito (primeiro componente do conteúdo)

**`.verdict-block`** com a classe de cor correta:

| Veredito | Classe |
|---|---|
| READY | `.verdict-ready` |
| READY COM RESSALVAS | `.verdict-ressalvas` |
| NEEDS REFINEMENT | `.verdict-refinement` |
| NOT READY | `.verdict-not-ready` |

- `.verdict-label`: `"Veredito"`
- `.verdict-value`: texto do veredito
- `.verdict-sub`: texto adicional opcional (ex: `"Pode entrar na sprint"`)
- `.verdict-scores`: mostrar `.score-item` para DoR e AI-Ready (omitir AI-Ready se não avaliado)

### Quality Gates

**`.doc-section`** com `.gates-row`:
- `.gate-chip.gate-pass` ou `.gate-chip.gate-fail` para cada gate
- Gate 5 `(AT)` apenas quando AT foi fornecido

### Matriz de DoR

**`.doc-section`** com `.data-table` (cols: Critério · Status · Evidência / Pendência)
- Usar `.status-badge` com a classe correta:
  - `.status-ok` — critério atendido
  - `.status-partial` — atendido parcialmente
  - `.status-pending` — pendente
  - `.status-blocked` — bloqueado
  - `.status-na` — não aplicável

### Bloqueadores

**`.doc-section`** — incluir apenas se houver bloqueadores
- `.blocker-item` por bloqueador, com `.blocker-code` (`BLOQUEADOR`) e `.blocker-text`

### Findings (DUV / CON / RSK / DEP / COE)

**`.doc-section`** por tipo de finding (Pendências, Contradições, Riscos, Dependências, Coerência)
- `.finding-item` por finding, com `.finding-code` (ex: `DUV-001`), `.finding-title` (responsável / bloqueia) e `.finding-desc`

### Coerência HT × AT (apenas quando AT foi fornecido)

**`.doc-section.coherence-section`**:
- `.coherence-verdict` com classe de cor:
  - `.coherence-coerente` para COERENTE
  - `.coherence-ressalvas` para COERENTE COM RESSALVAS
  - `.coherence-incoerente` para INCOERENTE
- `.data-table` com CAs e status (`.status-ok` COBERTO / `.status-partial` PARCIAL / `.status-blocked` AUSENTE)
- `.finding-item` com código `COE-nnn` para cada lacuna de coerência

### Estratégia de testes

**`.doc-section`** com `.data-table` (cols: CA · Cenário · Tipo de Teste)

## Ordem das seções no HTML

1. Veredito (`verdict-block` + Quality Gates)
2. Resumo executivo (`doc-section` com `section-body`)
3. Matriz DoR (`doc-section`)
4. Regras de negócio (`doc-section` com `data-table`)
5. Bloqueadores (`doc-section` — omitir se vazio)
6. Pendências / DUV (`doc-section` — omitir se vazio)
7. Contradições / CON (`doc-section` — omitir se vazio)
8. Riscos / RSK (`doc-section` — omitir se vazio)
9. Dependências / DEP (`doc-section` — omitir se vazio)
10. Coerência HT × AT (`doc-section.coherence-section` — apenas com AT)
11. Technical Design resumido (`doc-section`)
12. Estratégia de testes (`doc-section`)

## Regras

- Nunca alterar CSS, header ou footer do template
- Sempre embutir o CSS inline no `<style>`
- Preencher `<title>` igual ao `<h1>` do hero
- Seções sem conteúdo: omitir completamente
- Nunca trocar cor do `verdict-block`: READY=verde, RESSALVAS=amarelo, REFINEMENT=laranja, NOT READY=vermelho

## Onde salvar

Sugerir ao usuario: `.kiro/readiness/[ID]-relatorio.html`
