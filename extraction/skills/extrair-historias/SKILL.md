---
name: extrair-historias
description: Extrai historias de usuario (HU) e historias tecnicas (HT) a partir de planilhas de visao geral ou texto, com narrativa completa, criterios de aceite e referencias cruzadas.
---

# Extrair Historias de Usuario

## Quando usar

Use esta skill quando o usuario quiser:
- Extrair historias de usuario de uma planilha Excel de visao geral
- Converter um documento de backlog em historias formatadas
- Gerar historias a partir de texto descritivo de funcionalidades

## Processo passo a passo

### 0. Identificar o modelo de operacao

Antes de iniciar, pergunte ao usuario qual modelo deseja usar:

> **Modelo Padrao** - narrativa "Eu como... quero... para que...", campo "Integracoes Internas", agnostico de dominio
> **Modelo GFO + TJ** - narrativa "A fim de... precisa-se...", campo "Integracoes GFO", sem linguagem tecnica, criterios como "Resultados esperados"
> **Modelo SIMADE** - narrativa com multiplos atores e codigos SSC, campo "Integracoes SIMADE", criterios com sub-numeracao decimal, inclui versao e historico de evolucao

Se o usuario nao indicar, use o **Modelo Padrao**.

No modelo GFO+TJ, carregue e siga a steering `dev.kiro/steering/diretrizes-gfo-tj.md` antes de gerar as historias.

No modelo SIMADE, carregue e siga a steering `dev.kiro/steering/diretrizes-simade.md` antes de gerar as historias.

As regras de granularidade, classificacao HU/HT e numeracao de `regras-extracao.md` continuam iguais nos tres modelos.

### 1. Obter o documento de entrada

- Se o usuario fornecer uma planilha Excel (.xlsx), use a tool `ler_planilha` para converter em texto estruturado
- Se o usuario colar texto direto no chat, use-o como entrada
- Se o usuario referenciar um arquivo com `#File`, leia o conteudo

### 2. Analisar o documento

Identifique no documento:
- Macro etapas do sistema
- Produtos (modulos/funcionalidades agrupadas)
- Funcionalidades descritas
- Integracoes mencionadas (internas e externas)
- Sistemas que serao substituidos
- Personas/atores (inferir do contexto)
- Regras de negocio explicitas (restricoes, validacoes, condicoes)

### 3. Extrair historias

Para cada funcionalidade encontrada, quebre em acoes atomicas seguindo a granularidade CRUD:

| Acao | Quando aplicar |
|---|---|
| Cadastrar / Registrar | Criar novo registro |
| Consultar | Visualizar dados existentes |
| Editar / Alterar | Modificar registro |
| Excluir / Cancelar / Inativar | Remover ou desativar |
| Filtrar | Aplicar criterios de busca |
| Exportar PDF | Gerar arquivo PDF (historia separada) |
| Exportar Excel | Gerar arquivo Excel (historia separada) |
| Importar | Carregar dados externos |
| Gerar relatorio | Criar documento/relatorio |
| Visualizar painel | Ver grafico ou dashboard |

### 4. Classificar como HU ou HT

- **HU (Historia de Usuario)**: O usuario interage diretamente (tela, botao, formulario)
- **HT (Historia Tecnica)**: O sistema executa sozinho (integracao automatica, rotina)

### 5. Escrever narrativa

**Modelo Padrao:**
> Eu, como [persona inferida],
> quero [acao atomica especifica],
> para que [valor de negocio real - nao apenas "registrar"].

**Modelo GFO+TJ:** seguir exatamente o formato "A fim de... precisa-se..." de `diretrizes-gfo-tj.md`.

**Modelo SIMADE:** listar todos os perfis SSC identificados na fonte, seguir exatamente o formato de `diretrizes-simade.md`:
> Como [Persona1 (SSC: CODIGO = "PAPEL")],
> [Persona2 (SSC: CODIGO = "PAPEL")],
> eu quero [acao atomica especifica],
> para [valor esperado].

### 6. Preencher campos

- Prioridade: inferir do documento quando possivel, senao "A definir"
- Complexidade: inferir do documento quando possivel, senao "A definir"
- Dependencias: mapear referencias cruzadas logicas entre historias
- Campo de integracoes internas: "Integracoes Internas" (Padrao), "Integracoes GFO" (GFO+TJ) ou "Integracoes SIMADE" (SIMADE)
- No modelo SIMADE: incluir campo "Versao" antes da narrativa e secao "Historico de Evolucao" ao final

### 7. Numerar sequencialmente

- HU: HU001, HU002, HU003... (sequencia global, nao reinicia entre etapas)
- HT: HT001, HT002, HT003... (sequencia propria global)

### 8. Mapear dependencias

Logica padrao de dependencias:
- Cadastrar X → sem dependencia (ou cadastros base)
- Consultar X → depende de Cadastrar X
- Editar X → depende de Cadastrar X
- Excluir X → depende de Cadastrar X
- Filtrar X → depende de Consultar X
- Exportar X → depende de Consultar X ou Gerar X

### 9. Formatar a saida

Usar o formato definido no steering `formato-historias.md` para o modelo escolhido:
- Narrativa (conforme modelo)
- Tabela de campos
- Criterios de aceite (3-5, especificos e testaveis) ou Resultados esperados (GFO+TJ)
- Regras de negocio (apenas se mencionadas no documento)
- Observacoes com rastreabilidade
- Tabela resumo ao final de cada macro etapa

### 10. Exportar

Pergunte ao usuario como deseja o resultado e onde salvar:
- Exibir no chat
- Salvar como arquivo Markdown (use `exportar_historias_markdown`) - caminho sugerido: `.kiro/extraction/historias.md`
- Salvar como planilha Excel (use `exportar_historias_excel`) - caminho sugerido: `.kiro/extraction/historias.xlsx`
- Ambos

O usuario pode aceitar a sugestao ou informar um caminho diferente. Sempre confirme antes de salvar.

## Regras importantes

- Cada historia = UMA unica acao (atomica)
- "Exportar PDF" e "Exportar Excel" sao SEMPRE historias separadas
- Fontes ou formatos diferentes de importacao sao historias separadas
- Integracoes automaticas sao HT, acoes manuais equivalentes sao HU
- NAO invente funcionalidades que nao estejam no documento
- NAO invente regras de negocio
- Criterios de aceite devem ser especificos e testaveis (nao genericos)
- Usar "A definir" para campos sem informacao suficiente (nao inventar)
- Se informacao nao esta disponivel, usar "-" ou "A definir"

## Volume esperado

Para referencia, um modulo tipico de sistema:
- ~100 linhas de funcionalidades na planilha
- Gera aproximadamente 150 a 250 historias (HU + HT)
- Proporcao tipica: ~85% HU e ~15% HT
