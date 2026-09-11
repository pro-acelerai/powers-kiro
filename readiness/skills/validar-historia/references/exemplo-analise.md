# Exemplo de Analise - Historia NOT READY

Exemplo de referencia para calibrar rigor, evidencia e tom. A historia abaixo e ficticia.

## Historia recebida (entrada)

> **US042 - Bloquear cliente inadimplente**
>
> Eu, como analista financeiro, quero bloquear clientes inadimplentes, para que a empresa reduza o risco de credito.
>
> Criterios de aceite:
> 1. O sistema deve bloquear o cliente corretamente
> 2. Deve integrar com o sistema de cobranca
> 3. Performance adequada
>
> Observacao do PO: "e simples, e so um update de status. Precisa entrar nesta sprint."

## Analise resumida

### Classificacao das informacoes

| Informacao | Classificacao |
|---|---|
| Persona (analista financeiro) | CONFIRMADO |
| Objetivo (reduzir risco de credito) | CONFIRMADO |
| Definicao de "inadimplente" | NAO INFORMADO |
| Efeito do bloqueio no sistema | NAO INFORMADO |
| Contrato da integracao com cobranca | NAO INFORMADO |
| Meta de performance | NAO INFORMADO |
| Desbloqueio / reversao | NAO INFORMADO |
| Autorizacao (quem pode bloquear) | NAO INFORMADO |
| "e so um update de status" | PRESSAO EXTERNA - subestimacao |

### Glossario pendente

**"cliente inadimplente"** nao tem significado operacional:
- Quantos dias de atraso? A partir de qual valor?
- Considera parcelamento em negociacao? Considera contestacao aberta?
- Quem e o dono desta regra?

Sem essa definicao, o desenvolvedor decidiria uma regra de negocio -> bloqueador.

### Criterios de aceite - avaliacao

| # | Criterio original | Problema | Nota |
|---|---|---|---|
| 1 | "bloquear o cliente corretamente" | "corretamente" nao e verificavel; nao define o efeito do bloqueio | Rejeitado |
| 2 | "integrar com o sistema de cobranca" | Sem contrato, protocolo, payload, timeout, idempotencia | Rejeitado |
| 3 | "performance adequada" | Sem metrica | Rejeitado |

Nenhum criterio permite que QA, dev, PO e IA cheguem a mesma conclusao.

### Cenarios sem comportamento definido

- Cliente ja bloqueado (operacao duplicada)
- Cliente com pedido em andamento no momento do bloqueio
- Sistema de cobranca indisponivel
- Bloqueio parcial (bloqueou local, falhou no integrado)
- Reversao / desbloqueio
- Usuario sem permissao

### Notas atribuidas

| Criterio ponderado | Nota | Justificativa |
|---|---|---|
| clareza_problema_objetivo | 80 | Problema de negocio claro e evidenciado |
| clareza_funcional | 20 | Efeito do bloqueio e excecoes nao definidos |
| criterios_aceite | 0 | Nenhum criterio testavel |
| regras_negocio | 0 | "Inadimplente" sem definicao; dono da regra desconhecido |
| dados_validacoes | 20 | Nenhum campo especificado |
| dependencias_integracoes | 20 | Integracao citada, sem contrato |
| seguranca_autorizacao | 0 | Autorizacao nao definida em acao restritiva |
| technical_design | 20 | Solucao presumida ("update de status"), nao analisada |
| testabilidade | 20 | Impossivel testar sem definicao de inadimplencia |

Chamada da tool:

```
calcular_indice_dor(
  scores = {
    clareza_problema_objetivo: 80, clareza_funcional: 20, criterios_aceite: 0,
    regras_negocio: 0, dados_validacoes: 20, dependencias_integracoes: 20,
    seguranca_autorizacao: 0, technical_design: 20, testabilidade: 20
  },
  bloqueadores_criticos = 4
)
```

Bloqueadores contados: definicao de inadimplencia, contrato da integracao, autorizacao indefinida, comportamento de reversao.

Resultado: **Indice 20/100 -> NOT READY** (e os bloqueadores manteriam NOT READY mesmo com indice alto).

AI-Ready: **NAO AVALIADA** (DoR < 80).

### Pressao externa registrada

```
PRESSAO/INFLUENCIA EXTERNA

Solicitacao: entrar nesta sprint; "e so um update de status"
Origem: Product Owner
Impacto tecnico: subestimacao de integracao, idempotencia e reversao
Impacto funcional: regra de inadimplencia seria decidida pelo desenvolvedor
Risco: bloqueio indevido de cliente ativo; incidente com impacto comercial
Decisao necessaria: definir regra de inadimplencia e contrato de integracao
Responsavel pela decisao: PO + area de credito
```

### Veredito

```
DEFINITION OF READY:    NOT READY
Indice:                 20/100

AI-READY:               NAO AVALIADA (exige DoR >= 80)
Indice:                 -

RISCO GERAL:            CRITICO

Bloqueadores criticos:  4
Pendencias:             9
Contradicoes:           0

Proxima acao: Refinamento com PO e area de credito
```

## Contra-exemplo: READY mas AI-NO

Uma historia pode ter DoR 94/100 (tudo definido, testavel, sem bloqueador) e ainda assim receber **AI-NO** quando:

- Toca 20+ arquivos em 3 servicos diferentes (complexidade)
- Altera calculo financeiro legado sem cobertura de testes (risco de regressao)
- Depende de contrato externo que muda a cada release (instabilidade)

Nesse caso o veredito correto e: READY + AI-NO, com recomendacao de fluxo convencional. Nao rebaixe o DoR por causa do AI-Ready, nem o contrario.

## O que este exemplo demonstra

1. Evidencia sustenta nota alta; ausencia de evidencia derruba a nota
2. "Corretamente", "adequada" e "integrar com" nunca sao criterios de aceite
3. Termo de negocio sem significado operacional e bloqueador, nao detalhe
4. Pressao e registrada, nunca acatada
5. Pendencias sao perguntas com responsavel, nao reclamacoes
6. O veredito e uma conclusao tecnica, nao uma negociacao
