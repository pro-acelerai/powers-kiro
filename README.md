# Powers Kiro

Coleção de **Kiro Powers** — extensões MCP para o [Kiro IDE](https://kiro.dev) que adicionam fluxos especializados de desenvolvimento com controle de estado, gates de aprovação humana e rastreabilidade.

---

## Powers disponíveis

| Power | Descrição |
|---|---|
| [`pro-coding-power`](./pro-coding-power/) | Fluxo estruturado de implementação de histórias — planejamento, escrita de código, testes, lint e entrega com trilha de auditoria |
| [`modernization`](./modernization/) | Esteira de modernização de sistemas legados — Discovery, Architecture, Implementation e Delivery guiados por Especificação |

---

## Como usar um Power

Cada power é autocontido: o bundle MCP já está compilado em `mcp/dist/bundle.cjs` — não precisa de `npm install`.

1. Copie o `mcp.json` do power para `.kiro/settings/mcp.json` do seu projeto (ou mescle com o existente)
2. Reinicie o Kiro
3. O power aparece automaticamente como conjunto de tools disponíveis para o agente

---

## Estrutura de um Power

```
meu-power/
├── plugin.json          # Metadados do power (nome, versão, descrição)
├── mcp.json             # Configuração MCP para copiar ao projeto
├── POWER.md             # Documentação do power
├── skills/              # Skills Kiro (slash commands)
│   └── minha-skill/
│       └── SKILL.md
└── mcp/
    ├── src/             # Código-fonte TypeScript
    ├── dist/
    │   └── bundle.cjs   # Bundle autocontido (não requer npm install)
    ├── package.json
    └── tsconfig.json
```

---

## Desenvolvido por

**pro-acelerai** — Ferramentas de IA para times de desenvolvimento
