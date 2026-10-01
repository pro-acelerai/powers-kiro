---
description: Instrucoes para gerar versao HTML de documentos de historias extraidas pelo power Extraction
inclusion: manual
---

# Geracao de HTML — Extraction

Quando o usuario pedir uma versao `.html` do documento de historias extraidas, use `prodemge-template.html` (neste mesmo diretorio `dev.kiro/steering/`) como base de design.

## Como gerar o HTML

1. Leia `prodemge-template.html` para ter acesso ao CSS completo e todos os componentes
2. Crie um novo arquivo `.html` a partir do template — **nunca modifique o template**
3. Preencha os placeholders `<!-- ... -->` com os dados do documento

## Componentes a usar neste power

### Header
- `.header-badge`: `"Extraction · Histórias"` (ou `"Extraction · GFO+TJ"` / `"Extraction · SIMADE"`)

### Hero
- `.hero-eyebrow`: tipo do documento (ex: `"Histórias de Usuário · GFO+TJ"`)
- `.hero h1`: nome do módulo/sistema com `<span>` na palavra-chave (ex: `"Módulo de <span>Pagamentos</span>"`)
- `.hero-tagline`: quantidade e origem (ex: `"47 histórias extraídas a partir da planilha de visão geral"`)
- `.hero-meta`: total de histórias, quantidade de HUs, HTs, data de geração

### Conteúdo principal — repetir por macro etapa

**`.macro-section` + `.macro-header`**
- `.macro-number`: número da etapa com zero à esquerda (`01`, `02`...)
- `.macro-name`: nome da macro etapa
- `.macro-count`: `"N histórias · X HU · Y HT"`

**`.story-card`** — um por história dentro de cada macro etapa
- `.story-id`: ID da história (`HU001`, `HT001`...)
- Badge `.badge-hu` (azul) para HU, `.badge-ht` (roxo) para HT
- `.badge-gray` para prioridade (Alta / Média / Baixa)
- `.story-title`: título da história
- `.story-narrative`: narrativa formatada com `<strong>` nos termos-chave
- `.story-section-label` + `.ca-list`: critérios de aceite numerados
- `.story-section-label` + `.rules-list`: regras de negócio (incluir só se existirem)
- `.story-fields` + `.data-table`: campos de metadados (prioridade, complexidade, dependências, integrações)

### Tabela resumo ao final

**`.doc-section`** com `.data-table` de 6 colunas: ID · Tipo · Título · Prioridade · Complexidade · Dependências

## Regras

- Nunca alterar CSS, header ou footer do template
- Sempre embutir o CSS inline no `<style>` (não usar arquivo externo)
- Preencher `<title>` igual ao `<h1>` do hero
- Usar `.badge-hu` para HU e `.badge-ht` para HT — nunca trocar
- `.story-card:last-child` dentro de uma `.macro-section` recebe o `border-radius` inferior automaticamente via CSS
- Para história standalone (fora de macro etapa), adicionar classe `.standalone` ao `.story-card`

## Onde salvar

Sugerir ao usuario: `.kiro/extraction/[NOME-DOCUMENTO]-historias.html`
