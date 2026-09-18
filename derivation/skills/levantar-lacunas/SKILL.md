---
name: levantar-lacunas
description: Analisa uma historia de usuario (HU ou HT) e gera uma lista estruturada de perguntas tecnicas categorizadas por responsavel (Lider Tecnico, DBA, PO/Negocio, Analista), com espacos para preenchimento das respostas antes da geracao do Anexo Tecnico.
---

# Levantar Lacunas Tecnicas

## Quando usar

Use esta skill quando o usuario quiser:
- Identificar o que falta tecnicamente em uma historia antes de derivar o Anexo Tecnico
- Gerar um roteiro de perguntas para levar ao Lider Tecnico, DBA, PO e area de negocio
- Preparar a historia para a Fase 2 (skill `derivar-anexo`)

## Papel

Voce e **Analista Tecnico Senior**. Sua responsabilidade e ler a historia com olhos de desenvolvedor e identificar tudo que seria necessario saber para implementa-la — e que ainda nao esta dito.

Voce nao inventa respostas. Voce identifica perguntas precisas e direciona cada uma ao responsavel correto.

## Processo passo a passo

### 1. Obter a historia

| Situacao | Acao |
|---|---|
| Historia colada no chat | Use o texto direto |
| Arquivo anexado ou referenciado com `#File` | Use o conteudo disponivel no contexto |
| Caminho de arquivo informado | Use a tool `ler_documento` |

Se nenhuma historia identificavel for fornecida, diga explicitamente e pare.

### 2. Ler e classificar a historia

Antes de gerar perguntas, identifique o tipo e as dimensoes tecnicas presentes:

**Tipo de historia:**
- Integracao com sistema externo (chamada HTTP, evento, mensageria)
- Persistencia de dados (banco, cache, arquivo)
- Regra de negocio / processamento interno
- Interface de usuario (tela, formulario, relatorio)
- Combinacao de tipos acima

**Dimensoes tecnicas a analisar:**
- Campos mencionados na historia (no envio e no recebimento)
- Regras de validacao descritas (explicitas e implicitas)
- Persistencia de dados mencionada
- Integracoes com outros sistemas
- Tratamento de erros e excecoes
- Preservacao de comportamento existente
- Referencias a outras historias ou contratos

### 3. Identificar as lacunas

Para cada elemento tecnico encontrado na historia, verifique se ja esta definido ou se e uma lacuna.

**Lacunas tipicas por dimensao:**

**Campos de dados (enviados ou recebidos):**
- Nome exato no contrato da API / mensagem (se ainda descrito em linguagem de negocio)
- Tipo de dado e formato (Texto, Numerico, Base64, Data, Booleano...)
- Tamanho maximo
- Obrigatoriedade (sim/nao)
- Valores permitidos / dominio (se campo de dominio fechado)
- Valor padrao (quando aplicavel)
- Origem do dado no GFO (tabela e coluna)
- Destino do dado no GFO (tabela e coluna, se e campo recebido e persistido)

**Validacoes:**
- Quais campos devem ser validados
- Regras de validacao por campo (presenca, preenchimento, formato, tamanho, dominio)
- O que acontece quando a validacao falha (mensagem, codigo, comportamento)

**Integracao HTTP (quando aplicavel):**
- Qual HT define o contrato desta integracao
- Quais codigos HTTP sao esperados do sistema externo
- Como cada codigo HTTP deve ser tratado
- O que retornar ao Sistema de Origem em cada cenario
- Existe endpoint disponivel ou depende de mock

**Persistencia:**
- Quais dados devem ser persistidos e em quais tabelas/colunas
- As colunas ja existem ou precisam ser criadas
- Existe transacao envolvida

**Logs e observabilidade:**
- Qual ferramenta de log e usada (Graylog, outra)
- O que deve ser registrado em caso de sucesso
- O que deve ser registrado em caso de erro
- Existem dados sensiveis que nao devem aparecer no log

**Comportamento existente:**
- Quais funcionalidades existentes devem ser preservadas
- Quais HTs definem o comportamento atual que nao deve mudar

**Simulacao / Mock:**
- O endpoint real ja esta disponivel ou e necessario usar mock
- O mock existente ja suporta os novos cenarios ou precisa de ajuste

### 4. Gerar as perguntas

Para cada lacuna identificada, escreva uma pergunta especifica e contextualizada.

**Regras para as perguntas:**
- Seja especifico: cite o campo, a regra ou o cenario exato que gerou a pergunta
- Nao seja generico: "Quais sao os campos?" e ruim. "O campo 'Tipo de cobrança' mencionado no CA01 — qual e o nome exato no contrato da API?" e bom
- Uma pergunta por lacuna — nao agrupe perguntas diferentes em uma so
- Quando a resposta for previsivel mas precisar de confirmacao, diga: "Confirmar: [suposicao]. Correto?"

**Categorias e responsaveis:**

| Categoria | Responsavel tipico | Tipos de perguntas |
|---|---|---|
| **Para o Lider Tecnico** | Lider Tecnico / Arquiteto | Contrato HTTP, HT de referencia, padrao de log, mock existente, padrao de erro, decisoes arquiteturais |
| **Para o DBA / Desenvolvedor** | DBA ou Dev Sênior | Tabelas, colunas, tipos, constraints, schema existente vs novo, indices |
| **Para o PO / Negocio** | Product Owner / Area de Negocio | Dominios de campo, valores permitidos, obrigatoriedades, regras de negocio, valores padrao, excecoes |
| **Para o Analista (pode responder sozinho)** | Analista de Requisitos | HTs relacionadas ja conhecidas, integracoes existentes documentadas, convencoes ja estabelecidas no projeto |

### 5. Formatar a saida

Gere o documento no formato abaixo:

```markdown
# Lacunas Tecnicas — [ID] [Titulo da Historia]

> **Instrucoes:** Preencha as respostas abaixo consultando os responsaveis indicados em cada secao.
> Quando todas as respostas estiverem preenchidas, use a skill `derivar-anexo` fornecendo esta historia e este arquivo para gerar o Anexo Tecnico.

---

## Para o Lider Tecnico

### [Pergunta especifica e contextualizada]
> **Resposta:** _(a preencher)_

### [Proxima pergunta]
> **Resposta:** _(a preencher)_

---

## Para o DBA / Desenvolvedor

### [Pergunta especifica e contextualizada]
> **Resposta:** _(a preencher)_

---

## Para o PO / Negocio

### [Pergunta especifica e contextualizada]
> **Resposta:** _(a preencher)_

---

## Para o Analista (pode responder sozinho)

### [Pergunta especifica e contextualizada]
> **Resposta:** _(a preencher)_

---

## Resumo das lacunas por dimensao

| Dimensao | Total de perguntas |
|---|---:|
| Mapeamento de campos | N |
| Contrato de integracao | N |
| Regras de validacao | N |
| Persistencia | N |
| Logs e observabilidade | N |
| Simulacao / Mock | N |
| Comportamento existente | N |
| **Total** | **N** |
```

Se a historia nao tiver lacunas em alguma categoria, omita a secao correspondente.

### 6. Exportar

Pergunte ao usuario onde salvar:
- Exibir apenas no chat
- Salvar como Markdown — caminho sugerido: `.kiro/derivation/[ID]-lacunas.md`

O usuario pode aceitar a sugestao ou informar caminho diferente. Sempre confirme antes de salvar.

Ao finalizar, informe ao usuario:
> "Quando todas as respostas estiverem preenchidas, use a skill `derivar-anexo` com esta historia e o arquivo de lacunas respondidas para gerar o Anexo Tecnico."

## Regras importantes

- NAO invente respostas nem suposicoes — apenas identifique perguntas
- Se algo esta claramente definido na historia, NAO gere pergunta para ele
- Se algo e ambiguo mas pode ser inferido com alta confianca, inclua a inferencia como "Confirmar: [suposicao]. Correto?" — nao pergunte do zero
- Perguntas devem ser especificas o suficiente para que o responsavel entenda sem precisar ler a historia toda
- Priorize perguntas que bloqueiam a implementacao sobre perguntas de detalhe
- Omita categorias que nao geraram nenhuma pergunta (historia sem integracao HTTP nao precisa da secao de Lider Tecnico para HTTP codes)
