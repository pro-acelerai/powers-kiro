---
inclusion: manual
---

# Diretrizes de Geracao de Historias - GFO + TJ (Tribunal de Justica)

> ATIVACAO: Estas diretrizes valem APENAS quando o usuario escolher o modelo **GFO + TJ**
> (ou indicar explicitamente que a geracao e para o cliente TJ / Tribunal de Justica,
> ou referenciar esta steering via `#diretrizes-gfo-tj`).
>
> PRECEDENCIA: Quando ativas, estas regras SUBSTITUEM o formato de narrativa e de
> criterios de aceite definidos em `formato-historias.md`. As regras de
> granularidade e numeracao de `regras-extracao.md` continuam valendo normalmente.

## Tipos de historia no modelo GFO+TJ

O modelo GFO+TJ possui tres tipos de historia com estruturas distintas:

| Tipo | Quando usar | Narrativa |
|---|---|---|
| **HU** (Historia de Usuario) | Usuario interage diretamente com a tela (tela, botao, formulario) | Como / quero / para |
| **HT** (Historia Tecnica) | Sistema executa automaticamente (integracao, rotina, processamento) | A fim de / precisa-se |
| **HM** (Historia de Melhoria) | Adequacao ou ajuste de funcionalidade ja existente no sistema | Temos / Queremos |

Identificar o tipo correto a partir do documento fonte antes de escrever a historia.

---

## Template HU — Historia de Usuario

```markdown
**Como** [persona/ator inferido do contexto]

**quero** [acao que o usuario executa]

**para** [beneficio ou valor esperado]

_Caminho: > [caminho de navegacao no sistema, ex: Menu > Submenu > Tela]_

-------------

**Criterios de Aceite:**

**CA01:** _Cenario: [titulo do cenario]_

> **Dado** [pre-condicao ou estado inicial]
>
> **Quando** [acao realizada pelo usuario]
>
> **Entao** [resultado esperado pelo sistema]

**CA02:** _Cenario: [titulo do cenario]_

> **Dado** [pre-condicao ou estado inicial]
>
> **Quando** [acao realizada pelo usuario]
>
> **Entao** [resultado esperado pelo sistema]

**Importante:** Ao referenciar a exibicao de **mensagem padrao**, seja [do modulo](https://git.prodemge.gov.br/prodemge-doc/dsg/ssc/gsj/tjmg-gfo_visao_geral/gfo-wiki-documentacao/-/wikis/Mensagens-Previs%C3%A3o-de-Receitas) ou [do sistema GFO](https://git.prodemge.gov.br/tjmg-gfo_visao_geral/gfo-wiki-documentacao/-/wikis/Mensagens-Globais), deve-se reproduzir a referencia completa da mensagem (texto + codigo). Por exemplo: "(...) **Entao** exibe a seguinte mensagem: Operacao realizada com sucesso. _(msg_gfo_success_1)_"

-------------

**PROTOTIPOS**

-------------

**Anexos**

**Tabela de mapeamento de campos e comandos**

*Obs.: Utilize esta tabela sempre que for necessario incluir detalhes adicionais sobre os dados e os comandos descritos na Historia e/ou apresentados no prototipo, visando uma melhor compreensao dos requisitos.*

| Campos e Comandos | Descricao | Formato | Observacao |
|---|---|---|---|
| Nome do campo ou comando | Acao realizada no campo ou pelo comando | Formato do campo ou do comando | Informacoes complementares |
|  |  |  |  |
```

---

## Template HT — Historia Tecnica

```markdown
**A fim de** [objetivo ou beneficio que se deseja alcancar],

**precisa-se** [necessidade que deve ser atendida].

-------------

**Resultados esperados:**

**CA01:** [primeiro resultado verificavel]

**CA02:** [segundo resultado verificavel]
```

---

## Template HM — Historia de Melhoria

```markdown
**Historia Referencia:** [codigo e titulo / hiperlink pagina da Wiki]

**Temos** [descricao da situacao atual — o que existe hoje]

**Queremos** [descricao da situacao desejada — o que precisa mudar]

---------------

**Resultados esperados:**

**CA01:** [primeiro resultado verificavel]

**CA02:** [segundo resultado verificavel]

**Importante:** Ao referenciar a exibicao de **mensagem padrao**, seja [do modulo](https://git.prodemge.gov.br/prodemge-doc/dsg/ssc/gsj/tjmg-gfo_visao_geral/gfo-wiki-documentacao/-/wikis/Mensagens-Previs%C3%A3o-de-Receitas) ou [do sistema GFO](https://git.prodemge.gov.br/tjmg-gfo_visao_geral/gfo-wiki-documentacao/-/wikis/Mensagens-Globais), deve-se reproduzir a referencia completa da mensagem (texto + codigo). Por exemplo: "(...) **Entao** exibe a seguinte mensagem: Operacao realizada com sucesso. _(msg_gfo_success_1)_"

-------------

**PROTOTIPOS**

-------------

**Anexos**

**Tabela de mapeamento de campos e comandos**

*Obs.: Utilize esta tabela sempre que for necessario incluir detalhes adicionais sobre os dados e os comandos descritos na Historia e/ou apresentados no prototipo, visando uma melhor compreensao dos requisitos.*

| Campos e Comandos | Descricao | Formato | Observacao |
|---|---|---|---|
| Nome do campo ou comando | Acao realizada no campo ou pelo comando | Formato do campo ou do comando | Informacoes complementares |
|  |  |  |  |
```

---

## Regras de escrita

### Narrativa HU (Como / quero / para)

- Inferir a persona/ator a partir do contexto do documento
- Se o documento nao deixar claro o ator, usar "usuario do sistema"
- O campo "para" deve refletir o valor de negocio real — nao apenas "para que fique registrado"
- O campo "Caminho" deve indicar a navegacao no sistema quando identificada no documento; usar "A definir" se nao houver informacao

### Criterios de Aceite HU (BDD — Dado / Quando / Entao)

- Cada CA deve ter um titulo de cenario descritivo
- "Dado" descreve o estado ou pre-condicao antes da acao
- "Quando" descreve a acao do usuario que dispara o comportamento
- "Entao" descreve o resultado esperado pelo sistema
- Ao mencionar mensagem de feedback exibida ao usuario, incluir texto e codigo da mensagem conforme o catalogo do modulo ou do sistema GFO
- Nao inventar codigos de mensagem — usar apenas os codigos presentes no catalogo referenciado

### Narrativa HT (A fim de / precisa-se)

"A fim de" representa o PORQUE da necessidade (objetivo ou beneficio para o processo de negocio).
Exemplos validos: garantir que os dados estejam atualizados; garantir que somente informacoes validas sejam utilizadas; evitar que informacoes inconsistentes sejam replicadas.
Nao usar objetivos tecnicos: "para que o sistema consiga chamar a API"; "para que o endpoint retorne os dados".

"precisa-se" representa o QUE precisa ser disponibilizado, verificado, controlado ou realizado.
Deve ser compreensivel para uma pessoa de negocio — sem termos tecnicos.

### Resultados esperados (HT e HM)

Descrevem comportamentos e resultados validaveis pelo negocio. Devem responder:
"Como o Product Owner podera verificar que essa necessidade foi atendida?"

Preferir frases como: "Deve ser possivel identificar..."; "Deve ser possivel consultar...";
"Devem ser disponibilizadas..."; "Somente informacoes que... devem ser consideradas...";
"Quando ocorrer..., deve ser informado...".

Evitar criterios de implementacao: "O endpoint deve utilizar GET"; "A API deve retornar HTTP 200";
"A resposta JSON deve conter...".

### Narrativa HM (Temos / Queremos)

- "Temos" descreve a situacao atual do sistema — o comportamento ou dado existente que precisa mudar
- "Queremos" descreve a situacao desejada — o que o sistema deve fazer apos a melhoria
- "Historia Referencia" deve apontar para a historia original na Wiki quando existir
- Nao inventar a historia de referencia se ela nao estiver identificada no documento fonte

### Linguagem — valido para todos os tipos

Nao usar termos tecnicos de implementacao na narrativa nem nos criterios/resultados:
endpoint, API, GET / POST / PUT / DELETE, backend, frontend, banco de dados, tabela
(quando puder ser substituido por "dados" ou "informacoes"), payload, request / response,
servico, microservico, URL, codigo HTTP, autenticacao tecnica, autorizacao tecnica.

Detalhes tecnicos identificados na fonte devem ser preservados como observacoes tecnicas
fora do corpo da historia. Nao inventar necessidade de negocio ausente na fonte.

### Preservacao das regras de negocio

Nao simplificar a ponto de perder regras importantes. Manter todos os comportamentos
de negocio da fonte, especialmente: condicoes para utilizacao dos dados; condicoes que
impedem a utilizacao; tratamento de informacoes nao publicadas; necessidade de validacao;
comportamento em caso de inconsistencia; dependencias entre etapas do processo.

### Nao criar informacoes que nao estejam na fonte

Usar exclusivamente as informacoes dos documentos fornecidos. Nao inventar: novos atores,
regras de negocio, fluxos, funcionalidades, criterios, campos ou comportamentos.

Quando a informacao nao estiver suficientemente detalhada, deixar o campo em branco
ou indicar "A definir" para preenchimento posterior.

---

## Verificacao interna obrigatoria

Antes de apresentar cada historia, verificar conforme o tipo:

**HU:**
> "O criterio de aceite esta no formato Dado/Quando/Entao com cenario nomeado?"
> "O caminho de navegacao foi preenchido ou marcado como 'A definir'?"

**HT:**
> "Um Product Owner sem conhecimento de TI conseguiria entender esta historia sem
> precisar perguntar o que e uma API, endpoint, GET, backend ou servico?"
> Se a resposta for 'nao', reescrever usando linguagem de negocio.

**HM:**
> "'Temos' descreve claramente o estado atual e 'Queremos' o estado desejado?"
> "A Historia Referencia foi identificada no documento ou marcada como 'A definir'?"
