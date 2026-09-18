---
description: Instrucoes para gerar versao HTML do Anexo Tecnico produzido pelo power Derivation
inclusion: manual
---

# Geracao de HTML — Derivation

Quando o usuario pedir uma versao `.html` do Anexo Tecnico (`.kiro/derivation/[ID]-anexo-tecnico.md`), use `prodemge-template.html` (neste mesmo diretorio `dev.kiro/steering/`) como base de design.

## Como gerar o HTML

1. Leia `prodemge-template.html` para ter acesso ao CSS completo e todos os componentes
2. Crie um novo arquivo `.html` a partir do template — **nunca modifique o template**
3. Preencha os placeholders `<!-- ... -->` com os dados do Anexo Tecnico

## Componentes a usar neste power

### Header
- `.header-badge`: `"Derivation · Anexo Técnico"`

### Hero
- `.hero-eyebrow`: `"Anexo Técnico · [ID DA HISTÓRIA]"`
- `.hero h1`: título da história com `<span>` no ID (ex: `"<span>HT1252</span> — Integração SICOMP"`)
- `.hero-tagline`: tipo de história + breve descrição
- `.hero-meta`: ID da história, tipo (integração/persistência/negócio), data de geração, status de pendências

### Conteúdo principal — seções do AT

Incluir apenas as **seções aplicáveis** à história (ver POWER.md para tabela de seções condicionais).

**`.doc-section`** com **`.at-section-header`** — uma por seção do AT
- `.at-section-number`: número da seção (círculo vermelho)
- `.section-title`: nome da seção

**Seções sempre presentes (1–4 e 12–14):**

| Seção | Componentes internos |
|---|---|
| 1. Objetivo | `.section-body` |
| 2. Contexto / Integração | `.section-body` + `.flow-row` se houver fluxo sequencial |
| 3. Campos enviados | `.sub-label` por sub-seção + `.data-table` (cols: Campo · Descrição · Obrigatório · Formato · Origem/Regra) |
| 4. Campos recebidos | `.sub-label` por sub-seção + `.data-table` |
| 12. Mapeamento consolidado | `.data-table` (cols: Campo HT · Campo AT · Observação) |
| 13. Considerações | `.section-body` com lista `.rules-list` |
| 14. Referências | `.section-body` com lista `.rules-list` ou `.data-table` |

**Seções condicionais (5–11):**

| Seção | Quando incluir | Componentes internos |
|---|---|---|
| 5. Validações | quando há regras de validação por campo | `.data-table` (cols: Campo · Condição · Tratamento · Código HTTP) com `.row-error` nas linhas de erro |
| 6. Persistência | quando há escrita em banco | `.data-table` (cols: Tabela · Colunas · Operação · Condição) |
| 7. Códigos HTTP | quando é integração HTTP | `.data-table` (cols: Código · Situação · Resposta) com `.row-error` para erros |
| 8. Logs / Observabilidade | quando há requisitos de log | `.data-table` (cols: Nível · Momento · Mensagem) |
| 9. Chamada prévia | quando depende de chamada anterior | `.section-body` + `.flow-row` |
| 10. Simulação / Mock | quando há mock ou stub | `.section-body` + `.data-table` de exemplos |
| 11. Cenários de teste | sempre recomendado | `.data-table` (cols: Cenário · Resultado esperado) com `.row-success`/`.row-error` |

### Pendências

Para cada campo com `[PENDENTE]` no `.md`, usar **`.pendente-block`** logo após a seção correspondente:
- `.pendente-icon`: `⚠️`
- `.pendente-title`: `"PENDENTE — aguardando resposta do [RESPONSÁVEL]"`
- `.pendente-desc`: descrição da lacuna

Se houver pendências, adicionar bloco de aviso geral no topo do conteúdo antes das seções do AT.

## Regras

- Nunca alterar CSS, header ou footer do template
- Sempre embutir o CSS inline no `<style>`
- Preencher `<title>` igual ao `<h1>` do hero
- Seções sem conteúdo aplicável: omitir completamente (não incluir seção vazia)
- `.row-success` em cenários de sucesso, `.row-error` em cenários de erro — nunca inverter

## Onde salvar

Sugerir ao usuario: `.kiro/derivation/[ID]-anexo-tecnico.html`
