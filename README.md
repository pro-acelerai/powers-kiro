# Powers Kiro

Coleção de **Kiro Powers** — extensões para o [Kiro IDE](https://kiro.dev) que adicionam fluxos especializados de desenvolvimento com IA. Cada power combina skills, steering files e, quando necessário, um servidor MCP próprio com controle de estado, gates de aprovação humana e rastreabilidade completa.

---

## Powers disponíveis

| Power | Versão | Skills | MCP | Descrição |
|---|---|---|---|---|
| [`extraction`](./extraction/) | 1.0.0 | 2 | — | Extrai e refina histórias de usuário (HU/HT) a partir de planilhas ou texto |
| [`readiness`](./readiness/) | 1.0.0 | 2 | — | Valida histórias contra os 23 critérios de Definition of Ready e emite veredito |
| [`coding`](./coding/) | 0.2.0 | 1 | TypeScript | Implementa histórias com fluxo governado — agent propõe, Harness controla |
| [`upgrade`](./upgrade/) | 0.1.0 | 2 | TypeScript | Atualiza runtime, dependências e remedia CVEs in-place com rollback automático |
| [`modernization`](./modernization/) | 0.2.0 | 4 | TypeScript | Migra sistemas legados para stacks modernas via Reverse → Spec → Forward |

---

## Extraction

Converte planilhas Excel ou texto de visão geral em histórias completas com narrativa, critérios de aceite, regras de negócio, dependências cruzadas e tabela resumo por macro etapa. Segue granularidade CRUD — cada ação é uma história separada.

**Skills:**
- `extrair-historias` — quebra funcionalidades em ações atômicas, classifica HU/HT, numera sequencialmente (HU001..., HT001...), exporta em Markdown ou Excel
- `refinar-historias` — aplica checklist INVEST, melhora critérios de aceite, identifica gaps e gera cenários BDD (Dado / Quando / Então)

**Modelos de narrativa:**

| Modelo | Narrativa | Campo integrações | Destaques |
|---|---|---|---|
| **Padrão** | "Eu como… quero… para que…" | Integrações Internas | Agnóstico de domínio |
| **GFO + TJ** | "A fim de… precisa-se…" | Integrações GFO | Sem linguagem técnica, critérios como "Resultados esperados" |
| **SIMADE** | Múltiplos atores com código SSC | Integrações SIMADE | Sub-numeração decimal nos CAs (1, 1.1, 1.2…), versionamento e histórico de evolução |

---

## Readiness

Atua como Tech Lead guardião de qualidade. Recebe uma história de usuário e responde: *"Há informação suficiente, coerente e testável para implementar sem adivinhas?"*

Executa um fluxo de 3 fases obrigatórias (Discovery → Análise Funcional → Technical Design), verifica 23 critérios de DoR e calcula dois índices ponderados.

**Skills:**
- `validar-historia` — fluxo completo de validação com índice DoR (0–100) e veredito final
- `avaliar-ai-ready` — avalia aptidão para execução por IA (ativado apenas quando DoR ≥ 80), calcula índice AI-Ready (0–100)

**Vereditos possíveis:** `READY` · `READY COM RESSALVAS` · `NEEDS REFINEMENT` · `NOT READY`

**Modelos:**
- **Padrão** — status genérico (Jira, GitHub, Azure, Linear…)
- **GFO** — labels GitLab específicos da equipe

---

## Coding

Implementa histórias de usuário com controle governado. O agente raciocina e propõe; o Harness MCP valida cada transição do grafo de estados e garante que nenhum arquivo fora do escopo declarado seja tocado.

**Skill:**
- `implement-story` — 8 passos com parada obrigatória para aprovação humana antes de qualquer escrita no disco

**Fluxo:** Criar sessão → Ler escopo → Plano → Propor mudanças → **✋ Aprovação humana** → Aplicar → Lint → Corrigir

Backup automático de cada arquivo antes de sobrescrever. Trace completo salvo em `.kiro/trace/` ao final da sessão.

---

## Upgrade

Atualiza runtime, dependências com breaking changes, remedia CVEs e adota idiomas modernos da linguagem — aplicado in-place no projeto existente, sem reescrever lógica de negócio.

**Skills:**
- `analysis` — scan completo do projeto, identifica issues, propõe plano com gate humano de aprovação
- `execution` — aplica mudanças in-place e valida com lint + comando de build/testes do próprio projeto

Rollback automático se a escrita de arquivos falhar parcialmente. Casos de uso típicos: Java 21→25, Spring Boot 2→3, Node 18→22, React 17→18, Webpack→Vite, CVEs críticos.

---

## Modernization

Migra sistemas legados para stacks modernas com controle governado. O agente não copia código legado — extrai a intenção do sistema como especificação tecnologicamente agnóstica e reconstrói do zero na nova stack. O legado permanece intocado; o novo sistema roda em paralelo.

**Skills:**
- `discovery` — analisa o legado, extrai spec agnóstica, gate humano de aprovação
- `architecture` — projeta a nova arquitetura, submete plano faseado, gate humano de aprovação
- `implementation` — constrói o novo projeto fase por fase com lint + loop de correção
- `delivery` — consolida sessões e gera Migration Report completo

**Fases:** Discovery → Architecture → Implementation → Delivery

---

## Como usar um Power

Powers com MCP (coding, upgrade, modernization):

1. Copie o `mcp.json` do power para `.kiro/settings/mcp.json` do seu projeto (ou mescle com o existente)
2. Reinicie o Kiro — o power aparece automaticamente como conjunto de tools disponíveis
3. O bundle já está compilado em `mcp/dist/bundle.cjs` — não precisa de `npm install`

Powers sem MCP (extraction, readiness):

1. Copie a pasta do power para `.kiro/` do seu projeto (ou instale via Kiro Marketplace)
2. As skills ficam disponíveis como slash commands

---

## Estrutura de um Power

```
meu-power/
├── plugin.json              # Metadados (nome, versão, descrição, keywords)
├── mcp.json                 # Configuração MCP para copiar ao projeto (se aplicável)
├── POWER.md                 # Documentação e instruções de uso
├── dev.kiro/
│   └── steering/            # Steering files que moldam o comportamento do agente
│       ├── regras.md        # inclusion: auto — sempre carregado
│       └── diretrizes.md    # inclusion: manual — ativado por referência explícita
├── skills/                  # Skills Kiro (slash commands)
│   └── minha-skill/
│       └── SKILL.md
└── mcp/                     # Servidor MCP (apenas powers com lógica pesada)
    ├── src/                 # Código-fonte TypeScript
    ├── dist/
    │   └── bundle.cjs       # Bundle autocontido
    ├── package.json
    └── tsconfig.json
```

---

## Desenvolvido por

**pro-acelerai** — Ferramentas de IA para times de desenvolvimento
