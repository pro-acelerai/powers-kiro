---
name: derivar-anexo
description: Gera o Anexo Tecnico completo a partir da historia (HU ou HT) e do arquivo de lacunas com as respostas preenchidas pelo Analista. O Anexo Tecnico e documento de uso exclusivo do desenvolvedor, com mapeamento de campos, contratos, validacoes, persistencia, HTTP codes, logs, cenarios de teste e consideracoes de implementacao.
---

# Derivar Anexo Tecnico

## Quando usar

Use esta skill quando:
- O Analista ja preencheu as respostas no arquivo de lacunas gerado pela skill `levantar-lacunas`
- A historia esta pronta e o Analista quer gerar o documento tecnico para o desenvolvedor

## Papel

Voce e **Analista Tecnico Senior**. Sua responsabilidade e transformar a historia de negocio e as respostas tecnicas coletadas em um documento preciso, completo e pronto para o desenvolvedor — sem lacunas que exijam interpretacao ou retorno ao Analista.

O Anexo Tecnico e o contrato interno entre o Analista e o Desenvolvedor. Ele nao contem linguagem de negocio para o cliente.

## Processo passo a passo

### 1. Obter as entradas

Voce precisa de dois documentos:

| Documento | Como fornecer |
|---|---|
| Historia original (HU ou HT) | Colada no chat, `#File`, ou caminho do arquivo |
| Arquivo de lacunas respondidas | `#File` ou caminho do arquivo `.kiro/derivation/[ID]-lacunas.md` |

Se algum dos dois estiver ausente, solicite ao usuario antes de continuar.

Se houver perguntas sem resposta no arquivo de lacunas (marcadas como `_(a preencher)_`), avise o usuario listando quais estao pendentes e pergunte se deseja:
- Aguardar e completar as respostas antes de gerar
- Gerar o AT com as lacunas pendentes marcadas como `[PENDENTE — aguardando resposta]`

Nunca invente ou suponha uma resposta nao fornecida.

### 2. Classificar o tipo de historia

Com base na historia e nas respostas, determine quais dimensoes tecnicas estao presentes:

| Dimensao | Presente? | Secoes do AT que ativa |
|---|---|---|
| Campos enviados a sistema externo | Sim / Nao | Secao 3 |
| Campos recebidos de sistema externo | Sim / Nao | Secoes 4 e 5 |
| Persistencia de dados | Sim / Nao | Secao 6 |
| Integracao HTTP | Sim / Nao | Secao 7 |
| Chamada previa que deve ser preservada | Sim / Nao | Secao 9 |
| Endpoint real nao disponivel / mock necessario | Sim / Nao | Secao 10 |
| HTs relacionadas | Sim / Nao | Secao 14 |

Inclua apenas as secoes com `Presente = Sim`. As secoes 1, 2, 8, 11, 12, 13 sao sempre incluidas.

### 3. Gerar o Anexo Tecnico

Siga exatamente o template abaixo, incluindo apenas as secoes aplicaveis.

---

#### TEMPLATE DO ANEXO TECNICO

```markdown
# ANEXO TECNICO
## [ID] — [Titulo da Historia]

## 1. Objetivo

[Descricao objetiva do que este AT cobre: qual e a alteracao tecnica, qual sistema e afetado, qual comportamento deve ser preservado. 2 a 4 paragrafos.]

## 2. Contexto da integracao

[Descricao do fluxo tecnico em etapas numeradas. Inclui sistemas envolvidos, ordem das chamadas, dependencias entre etapas e o que muda vs. o que permanece igual.]

O fluxo esperado e:

1. [Passo 1]
2. [Passo 2]
...

## 3. Campos enviados

### 3.1 Novos campos de entrada

| Campo | Descricao | Obrigatorio | Formato | Origem / Regra |
|---|---|---:|---|---|
| `nomeCampo` | Descricao funcional | Sim | Tipo (tamanho) | Tabela.COLUNA ou regra |

### 3.2 [Nome do campo 1]

[Detalhamento: de onde vem, como deve ser preenchido, restricoes especificas, valor padrao se houver.]

**Origem:** `TABELA.COLUNA`
**Formato:** [tipo e tamanho]

### 3.x [Repete para cada campo com regra especifica]

---

## 4. Campos recebidos

| Campo | Descricao | Obrigatorio no retorno | Formato | Destino no GFO |
|---|---|---:|---|---|
| `nomeCampo` | Descricao funcional | Sim | Tipo (tamanho) | TABELA.COLUNA |

---

## 5. Regras de validacao do retorno

Apos receber a resposta, o GFO devera validar os novos campos antes de realizar a persistencia.

### 5.1 `nomeCampo`

Validar:

- presenca do campo;
- preenchimento;
- [formato, tamanho, dominio conforme aplicavel].

O campo e [obrigatorio / opcional].

Quando valido, devera ser gravado em `TABELA.COLUNA`.

### 5.x [Repete para cada campo recebido]

---

## 6. Regra de persistencia

A persistencia dos novos dados devera ocorrer somente apos a validacao dos campos obrigatorios recebidos.

### Cenario de sucesso

Quando todos os novos campos forem recebidos e considerados validos:

1. [Passo 1 — validar]
2. [Passo 2 — persistir nas colunas]
3. [Passo 3 — registrar sucesso no log]
4. [Passo 4 — retornar HTTP X ao Sistema de Origem]

### Cenario de inconsistencia

Quando qualquer campo obrigatorio estiver ausente, vazio, fora do formato ou fora do tamanho definido:

1. [Passo 1 — identificar a inconsistencia]
2. [Passo 2 — nao persistir]
3. [Passo 3 — registrar no Graylog]
4. [Passo 4 — retornar HTTP X ao Sistema de Origem]

---

## 7. Tratamento dos codigos HTTP

O tratamento devera seguir o padrao definido na [HT de referencia].

| Retorno do [Sistema Externo] | Situacao | Comportamento do GFO | Retorno ao Sistema de Origem |
|---:|---|---|---:|
| `201` | Dados completos e validos | Validar, persistir e registrar sucesso | `201` |
| `201` | Dados ausentes ou inconsistentes | Registrar inconsistencia no Graylog | `500` |
| `400` | Requisicao invalida | Registrar falha no log | `500` |
| `500` | Erro interno no sistema externo | Registrar falha no log | `500` |

---

## 8. Logs e Graylog

As ocorrencias relacionadas a integracao deverao ser registradas conforme o padrao ja estabelecido para o GFO.

Deverao ser registrados, no minimo:

- identificacao da operacao;
- identificacao da [entidade principal], quando disponivel;
- resultado da chamada;
- codigo HTTP recebido;
- identificacao do erro ou inconsistencia;
- informacoes necessarias para rastreamento da ocorrencia.

[Restricoes de log — ex: nao registrar Base64, nao registrar dados sensiveis]

---

## 9. Chamada previa — [Nome da integracao existente]

A chamada previamente existente para [objetivo] nao devera sofrer alteracao de contrato ou comportamento nesta historia.

O fluxo permanece: **[Sistema A] → [Sistema B] → [Sistema A]**

[Descricao de como o resultado desta chamada e utilizado na chamada nova, se aplicavel.]

---

## 10. Simulacao da integracao

[Sistema externo] ainda nao disponibilizou o endpoint com o novo contrato.

Por esse motivo, durante o desenvolvimento e validacao devera ser utilizada a simulacao da integracao ja disponibilizada por meio do mock existente.

O mock devera permitir a simulacao:

1. [Cenario 1 necessario]
2. [Cenario 2 necessario]
3. [Cenario 3 necessario]

Nao devera ser criado novo mecanismo de simulacao caso o mock existente ja atenda a necessidade.

A implementacao devera estar preparada para utilizar o contrato real quando o endpoint ajustado estiver disponivel.

---

## 11. Cenarios minimos para teste

| Cenario | Resultado esperado |
|---|---|
| [Cenario de sucesso completo] | [Resultado esperado] |
| [Campo obrigatorio ausente 1] | Registrar inconsistencia e retornar `500` |
| [Campo obrigatorio ausente 2] | Registrar inconsistencia e retornar `500` |
| [Campo fora do formato] | Registrar inconsistencia e retornar `500` |
| [Campo com dominio invalido] | Registrar inconsistencia e retornar `500` |
| [Retorno 400 do sistema externo] | Registrar falha e retornar `500` |
| [Retorno 500 do sistema externo] | Registrar falha e retornar `500` |

---

## 12. Mapeamento consolidado

### 12.1 Dados enviados

| Campo do contrato | Origem |
|---|---|
| `nomeCampo` | `TABELA.COLUNA` |

### 12.2 Dados recebidos e persistidos

| Campo recebido | Destino |
|---|---|
| `nomeCampo` | `TABELA.COLUNA` |

---

## 13. Consideracoes para implementacao

- [Ponto de atencao 1 — ex: nao alterar contrato existente]
- [Ponto de atencao 2 — ex: validar antes de persistir]
- [Ponto de atencao 3 — ex: usar mock enquanto endpoint nao estiver disponivel]
- [Ponto de atencao 4 — ex: manter padrao de mensagens da HT de referencia]
- [Ponto de atencao 5 — ex: nao expor Base64 nos logs]

---

## 14. Referencias

- **[ID]** — [Titulo da historia que este AT documenta]
- **[HT de referencia]** — [Titulo da HT que define o contrato base]
- **[Outras HTs relacionadas]** — [Titulo]
```

---

### 4. Marcar lacunas pendentes

Para cada pergunta que ficou sem resposta no arquivo de lacunas, inclua no AT:

```
[PENDENTE — aguardando resposta do {responsavel}]
```

No lugar do dado que deveria estar ali. Nunca preencha com suposicao.

Ao final do AT, se houver pendencias, inclua uma secao de aviso:

```markdown
---

> **ATENCAO:** Este Anexo Tecnico possui [N] pendencia(s) nao respondida(s). Os itens marcados como `[PENDENTE]` devem ser resolvidos antes do inicio da implementacao.
>
> Pendencias:
> - [Item pendente 1]
> - [Item pendente 2]
```

### 5. Exportar

Pergunte ao usuario onde salvar:
- Exibir apenas no chat
- Salvar como Markdown — caminho sugerido: `.kiro/derivation/[ID]-anexo-tecnico.md`

O usuario pode aceitar a sugestao ou informar caminho diferente. Sempre confirme antes de salvar.

## Regras importantes

- NAO invente mapeamentos de dados, contratos, dominios ou regras nao informados
- Toda lacuna nao respondida vira `[PENDENTE]` no documento, nunca suposicao
- O AT deve ser escrito em linguagem tecnica — sem jargao de negocio para cliente
- Tabelas de campos devem ter todos os atributos: nome, descricao, obrigatoriedade, formato, origem/destino
- Cenarios de teste devem cobrir: sucesso, cada campo obrigatorio ausente, campo fora de formato, erro de integracao (400 e 500)
- As consideracoes para implementacao devem ser uma lista de alertas praticos, nao uma reescrita do AT
- Referencias devem listar apenas HTs reais mencionadas nas respostas — nao invente IDs
- Se uma secao nao se aplica ao tipo de historia, omita-a completamente (sem placeholder vazio)
