# Upgrade Power

**Scan → Plan → Apply → Validate**

Upgrade de versao de runtime, dependencias com breaking changes, remediacoes de seguranca (CVE), adocao de idiomas modernos da linguagem e migracoes de toolchain — tudo aplicado in-place no projeto existente, sem reescrever logica de negocio.

---

## Quando usar

| Cenario | Exemplos |
|---|---|
| Versao de runtime | Java 21 → 25, Node 18 → 22, Python 3.9 → 3.12 |
| Dependencia major com breaking changes | Spring Boot 2 → 3, React 17 → 18, Hibernate 5 → 6 |
| Seguranca | CVEs em dependencias, padroes inseguros, credenciais hardcoded |
| Idiomas modernos | Java records/pattern matching, async/await em lugar de callbacks, type hints |
| Toolchain | Webpack → Vite, JUnit 4 → 5, Maven 3.x → Gradle |

**Nao use** para migracoes de stack completas (PHP → Node.js, JSP → React): para isso use o poder `modernization`.

---

## Fluxo

```
Fase 1 — Analysis
  upgrade-analysis (skill)
  Scan: le o projeto, identifica issues
  Plan: propoe mudancas com referencias por issue
  Human gate: aprova ou rejeita o plano (budget: 2 refinamentos)

Fase 2 — Execution
  upgrade-execution (skill)
  Load: carrega o plano aprovado da analysis
  Apply: aplica mudancas in-place com rollback automatico em caso de falha parcial
  Validate: lint + comando de build/teste configurado pelo usuario
  Correction loop: 3 tentativas totais
  Report: relatorio markdown salvo em artifactsPath
```

---

## Garantias do harness

- **Scope enforcement** — nenhum arquivo fora do escopo declarado pode ser modificado
- **Issue coverage sensor** — verifica se todos os issues `must_fix` do plano foram referenciados nas mudancas (aviso, nao bloqueio)
- **Rollback automatico** — se a escrita de arquivos falhar parcialmente, os ja escritos sao removidos
- **Traceability graph** — todo o rastro da sessao (raciocinio, issues, plano, mudancas, validacao) fica salvo em `.kiro/trace/upgrade/`
- **Correction budget** — maximo de 3 tentativas por execution; o harness impede novos ciclos apos esgotar
- **Validation command** — o harness roda o comando de build/testes do proprio projeto para garantir que nada quebrou

---

## Keywords de ativacao

upgrade, update, versao, version, dependencia, dependency, seguranca, security, cve, deprecated, breaking change, atualizar
