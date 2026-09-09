# Pro Coding Power

> Codificação com IA governada a partir de histórias de usuário.
> **Agent thinks. Harness controls. Graph explains.**

## O que é

Um [Kiro Power](https://agent-plugins.org/) que implementa histórias de usuário com um loop de controle governado. O agente raciocina e propõe mudanças — mas nenhuma linha é escrita no disco sem validação de escopo e aprovação explícita do desenvolvedor.

## Pré-requisito

- [Kiro](https://kiro.dev) instalado
- `node` >= 18 na máquina
- Workspace em um repositório git com working tree limpa — facilita reverter manualmente caso necessário

> O servidor MCP está pré-compilado em `mcp/dist/bundle.cjs` — não é necessário `npm install` ou build.

## Instalação

No Kiro, importe o power pelo GitHub:

```
https://github.com/Jorgim1/pro-coding/tree/master/pro-coding-power
```

## Como usar

Ative a skill `implement-story` descrevendo a história e o escopo:

```
Implemente a US-042: como usuário quero exportar relatório em PDF.
Escopo: src/reports/, src/utils/pdf.ts
```

O loop executa 8 passos controlados pelo Harness:

| Passo | Ferramenta | O que faz |
|---|---|---|
| 1 | `create_session` | Registra história e escopo autorizado |
| 2 | `read_scope` | Lê todos os arquivos do escopo |
| 3 | `submit_plan` | Grava raciocínio no grafo de rastreabilidade |
| 4 | `submit_proposed_change` | Propõe mudanças por arquivo com justificativa |
| 5 | `request_human_approval` | **Pausa para aprovação do desenvolvedor** |
| 6 | `apply_changes` | Grava arquivos com backup automático |
| 7 | `run_lint` | Roda ESLint (config do projeto ou padrão) |
| 8 | `submit_correction` | Corrige falhas de lint dentro do budget |

## Garantias

- Nenhum arquivo fora do escopo declarado pode ser modificado
- `apply_changes` é bloqueado até `request_human_approval` retornar `APPROVED`
- Backup automático antes de cada sobrescrita
- Trace completo salvo em `.kiro/trace/` ao final

## Estrutura

```
pro-coding-power/
├── plugin.json                        # Manifesto do power
├── mcp.json                           # Configuração do servidor MCP
├── mcp/                               # Servidor MCP (TypeScript)
│   ├── src/                           # Código-fonte
│   └── dist/bundle.cjs                # Bundle pré-compilado (autocontido)
└── skills/
    └── implement-story/
        └── SKILL.md                   # Instruções da skill para o agente
```

## Desenvolvimento

Para modificar o servidor MCP e publicar uma nova versão:

```bash
cd mcp
npm install
# edite src/
npm run bundle        # gera dist/bundle.cjs
```

Commite o `bundle.cjs` atualizado junto com as mudanças no `src/`.
