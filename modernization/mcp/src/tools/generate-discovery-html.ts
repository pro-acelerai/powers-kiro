import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppContext } from '../context.js'
import type { DiscoverySession, Finding } from '../domain/types.js'

function badge(text: string, color: string): string {
  return `<span class="badge" style="background:${color}">${text}</span>`
}

function severityColor(s: string): string {
  return { critical: '#c0392b', high: '#e67e22', medium: '#f1c40f', low: '#3498db', info: '#95a5a6' }[s] ?? '#95a5a6'
}

function classColor(c: string): string {
  return { BLOCKER: '#c0392b', MIGRATE_AND_FIX: '#e67e22', DOCUMENT: '#3498db' }[c] ?? '#95a5a6'
}

function classLabel(c: string): string {
  return { BLOCKER: 'Bloqueador', MIGRATE_AND_FIX: 'Corrigir na Reescrita', DOCUMENT: 'Documentar' }[c] ?? c
}

function resolutionLabel(r: string): string {
  return { fix_before: 'Corrigir antes de migrar', descope: 'Fora do escopo', accept_risk: 'Risco aceito' }[r] ?? r
}

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function findingCard(f: Finding): string {
  const decision = f.triageDecision
    ? `<div class="triage-box">
        <strong>Decisão de triage:</strong> ${resolutionLabel(f.triageDecision.resolution)}<br>
        <em>${escapeHtml(f.triageDecision.notes)}</em>
      </div>`
    : ''

  return `
    <div class="card finding-card">
      <div class="finding-header">
        <div>
          ${badge(classLabel(f.classification), classColor(f.classification))}
          ${badge(f.severity, severityColor(f.severity))}
        </div>
        <code class="file-ref">${escapeHtml(f.file)}${f.line ? `:${f.line}` : ''}</code>
      </div>
      <h3>${escapeHtml(f.title)}</h3>
      <p>${escapeHtml(f.description)}</p>
      <p class="recommendation"><strong>Recomendação:</strong> ${escapeHtml(f.recommendation)}</p>
      ${decision}
    </div>`
}

function dbDecisionLabel(d: string): string {
  return {
    migrate: 'Migrar para o novo banco',
    reimplement_in_application: 'Reimplementar na camada de aplicação',
    drop: 'Remover (não necessário)',
    keep_as_is: 'Manter no banco legado',
  }[d] ?? d
}

function dbDecisionColor(d: string): string {
  return { migrate: '#27ae60', reimplement_in_application: '#e67e22', drop: '#c0392b', keep_as_is: '#95a5a6' }[d] ?? '#95a5a6'
}

function specSection(discovery: DiscoverySession): string {
  const spec = discovery.specification
  if (!spec) return '<p class="empty">Especificação não disponível.</p>'

  const entities = spec.domainEntities.map(e => `
    <div class="spec-item">
      <strong>${escapeHtml(e.name)}</strong>
      <p>${escapeHtml(e.description)}</p>
      ${e.attributes.length ? `<div class="attr-list">${e.attributes.map(a => `<code>${escapeHtml(a)}</code>`).join(' ')}</div>` : ''}
    </div>`).join('')

  const rules = spec.businessRules.map(r => `
    <div class="spec-item">
      <div class="rule-id">${escapeHtml(r.id)}</div>
      <strong>${escapeHtml(r.title)}</strong>
      <p>${escapeHtml(r.description)}</p>
      <small class="source-ref">Origem: <code>${escapeHtml(r.sourceRef)}</code></small>
    </div>`).join('')

  const flows = spec.flows.map(f => `
    <div class="spec-item">
      <div class="rule-id">${escapeHtml(f.id)}</div>
      <strong>${escapeHtml(f.name)}</strong>
      <ol>${f.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
      <small class="source-ref">Origem: <code>${escapeHtml(f.sourceRef)}</code></small>
    </div>`).join('')

  const contracts = spec.externalContracts.map(c => `
    <div class="spec-item">
      <div class="rule-id">${escapeHtml(c.type.toUpperCase())}</div>
      <strong>${escapeHtml(c.name)}</strong>
      <p>${escapeHtml(c.description)}</p>
      <small class="source-ref">Origem: <code>${escapeHtml(c.sourceRef)}</code></small>
    </div>`).join('')

  const dbRules = (spec.databaseRules ?? []).map(r => `
    <div class="spec-item">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div class="rule-id">${escapeHtml((r.type ?? '').replace(/_/g, ' ').toUpperCase())}</div>
        ${badge(dbDecisionLabel(r.decision), dbDecisionColor(r.decision))}
      </div>
      <strong>${escapeHtml(r.name)}</strong>
      <p>${escapeHtml(r.description)}</p>
      <p style="font-size:13px;color:#555;margin-top:4px"><strong>Motivo da decisão:</strong> ${escapeHtml(r.rationale)}</p>
      <small class="source-ref">Origem: <code>${escapeHtml(r.sourceRef)}</code></small>
    </div>`).join('')

  const excluded = (spec.excludedScope ?? []).map(e => `
    <div class="spec-item" style="border-left:4px solid #e67e22">
      <code style="font-size:13px;color:#333">${escapeHtml(e.path)}</code>
      <p style="margin-top:6px;color:#555;font-size:14px">${escapeHtml(e.reason)}</p>
    </div>`).join('')

  const nfr = spec.nonFunctional.length
    ? `<ul>${spec.nonFunctional.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
    : '<p class="empty">Nenhum requisito não-funcional registrado.</p>'

  return `
    <div class="spec-group">
      <h3>Entidades de Domínio (${spec.domainEntities.length})</h3>
      ${entities || '<p class="empty">Nenhuma entidade registrada.</p>'}
    </div>
    <div class="spec-group">
      <h3>Regras de Negócio (${spec.businessRules.length})</h3>
      ${rules || '<p class="empty">Nenhuma regra registrada.</p>'}
    </div>
    <div class="spec-group">
      <h3>Fluxos (${spec.flows.length})</h3>
      ${flows || '<p class="empty">Nenhum fluxo registrado.</p>'}
    </div>
    <div class="spec-group">
      <h3>Contratos Externos (${spec.externalContracts.length})</h3>
      ${contracts || '<p class="empty">Nenhum contrato externo registrado.</p>'}
    </div>
    <div class="spec-group">
      <h3>Regras de Banco de Dados (${(spec.databaseRules ?? []).length})</h3>
      <p style="font-size:13px;color:#666;margin-bottom:12px">Triggers, procedures, jobs e funções — com decisão explícita sobre o que fazer na migração.</p>
      ${dbRules || '<p class="empty">Nenhuma regra de banco registrada.</p>'}
    </div>
    <div class="spec-group">
      <h3>Escopo Excluído (${(spec.excludedScope ?? []).length})</h3>
      <p style="font-size:13px;color:#666;margin-bottom:12px">Módulos e arquivos explicitamente fora do escopo da migração.</p>
      ${excluded || '<p class="empty">Nenhum escopo excluído registrado.</p>'}
    </div>
    <div class="spec-group">
      <h3>Requisitos Não-Funcionais</h3>
      ${nfr}
    </div>`
}

function buildHtml(discovery: DiscoverySession, generatedAt: string): string {
  const projectName = discovery.legacyPath.split(/[\\/]/).pop() ?? discovery.legacyPath
  const blockers = discovery.findings.filter(f => f.classification === 'BLOCKER')
  const migrateFix = discovery.findings.filter(f => f.classification === 'MIGRATE_AND_FIX')
  const document = discovery.findings.filter(f => f.classification === 'DOCUMENT')

  const critical = discovery.findings.filter(f => f.severity === 'critical').length
  const high = discovery.findings.filter(f => f.severity === 'high').length

  const thinkRows = discovery.thinkRecords.map((t, i) => `
    <div class="think-item">
      <div class="think-number">#${i + 1}</div>
      <div class="think-phase">${escapeHtml(t.phase)}</div>
      <div class="think-text">${escapeHtml(t.reasoning)}</div>
    </div>`).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Discovery — ${escapeHtml(projectName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; color: #1a1a2e; line-height: 1.6; }

  /* Header */
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%); color: #fff; padding: 40px 48px 32px; }
  .header-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.6; margin-bottom: 8px; }
  .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  .header-meta { display: flex; gap: 24px; margin-top: 16px; flex-wrap: wrap; }
  .header-meta-item { font-size: 13px; opacity: 0.75; }
  .header-meta-item strong { opacity: 1; color: #fff; }

  /* Stats bar */
  .stats-bar { display: flex; gap: 0; background: #fff; border-bottom: 1px solid #e8eaed; }
  .stat-tile { flex: 1; padding: 20px 24px; border-right: 1px solid #e8eaed; text-align: center; }
  .stat-tile:last-child { border-right: none; }
  .stat-number { font-size: 32px; font-weight: 700; line-height: 1; }
  .stat-label { font-size: 12px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-red { color: #c0392b; }
  .stat-orange { color: #e67e22; }
  .stat-blue { color: #3498db; }
  .stat-green { color: #27ae60; }

  /* Nav */
  .nav { display: flex; background: #fff; border-bottom: 2px solid #e8eaed; padding: 0 48px; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  .nav-btn { padding: 16px 20px; font-size: 14px; font-weight: 500; color: #666; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .15s; }
  .nav-btn:hover { color: #1a1a2e; }
  .nav-btn.active { color: #0f3460; border-bottom-color: #0f3460; font-weight: 600; }

  /* Content */
  .content { padding: 40px 48px; max-width: 1100px; margin: 0 auto; }
  .section { display: none; }
  .section.active { display: block; }

  /* Cards */
  .card { background: #fff; border-radius: 10px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.06); border: 1px solid #e8eaed; }
  .section-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; color: #1a1a2e; display: flex; align-items: center; gap: 10px; }
  .count-pill { background: #e8eaed; color: #444; border-radius: 20px; padding: 2px 10px; font-size: 13px; font-weight: 600; }

  /* Findings */
  .finding-card { border-left: 4px solid #e8eaed; }
  .finding-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
  .file-ref { font-size: 12px; color: #666; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
  .finding-card h3 { font-size: 16px; margin-bottom: 8px; }
  .recommendation { color: #444; font-size: 14px; margin-top: 8px; }
  .triage-box { margin-top: 12px; background: #f8f9fa; border-radius: 6px; padding: 12px; border-left: 3px solid #27ae60; font-size: 14px; }

  /* Badges */
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px; }

  /* Spec */
  .spec-group { margin-bottom: 36px; }
  .spec-group h3 { font-size: 16px; font-weight: 700; color: #0f3460; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e8eaed; }
  .spec-item { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 10px; border: 1px solid #e8eaed; }
  .spec-item strong { font-size: 15px; display: block; margin-bottom: 4px; }
  .spec-item p { font-size: 14px; color: #444; margin-bottom: 6px; }
  .rule-id { font-size: 11px; font-weight: 700; color: #0f3460; background: #e8f0fe; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 6px; letter-spacing: 0.5px; }
  .source-ref { color: #888; font-size: 12px; }
  .attr-list { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
  .attr-list code { background: #f5f5f5; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .spec-item ol { padding-left: 20px; font-size: 14px; color: #444; margin: 8px 0; }
  .spec-item li { margin-bottom: 4px; }

  /* Think records */
  .think-item { display: grid; grid-template-columns: 28px 120px 1fr; gap: 12px; background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 10px; border: 1px solid #e8eaed; align-items: start; }
  .think-number { font-size: 12px; font-weight: 700; color: #aaa; }
  .think-phase { font-size: 12px; font-weight: 600; color: #0f3460; background: #e8f0fe; padding: 2px 8px; border-radius: 4px; text-align: center; }
  .think-text { font-size: 14px; color: #333; white-space: pre-wrap; }

  /* Summary */
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .summary-card { background: #fff; border-radius: 10px; padding: 20px; border: 1px solid #e8eaed; }
  .summary-card h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 12px; }
  .summary-list { list-style: none; }
  .summary-list li { padding: 6px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; display: flex; justify-content: space-between; }
  .summary-list li:last-child { border-bottom: none; }
  .scope-list { list-style: none; }
  .scope-list li { padding: 4px 0; font-size: 13px; color: #444; }
  .scope-list li::before { content: '→ '; color: #0f3460; font-weight: 700; }
  .empty { color: #999; font-style: italic; font-size: 14px; }
  .findings-group-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 0 8px; color: #444; border-top: 1px solid #e8eaed; margin-top: 20px; }
  .findings-group-title:first-of-type { border-top: none; margin-top: 0; }
  .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .status-done { background: #e8f8f0; color: #27ae60; }

  @media (max-width: 768px) {
    .header, .content { padding: 24px 20px; }
    .nav { padding: 0 20px; }
    .stats-bar { flex-wrap: wrap; }
    .stat-tile { min-width: 50%; }
    .summary-grid { grid-template-columns: 1fr; }
    .think-item { grid-template-columns: 1fr; }
  }

  @media print {
    .nav { display: none; }
    .section { display: block !important; page-break-before: always; }
    .section:first-child { page-break-before: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-label">Relatório de Discovery — Modernização</div>
  <h1>${escapeHtml(projectName)}</h1>
  <div class="header-meta">
    <div class="header-meta-item"><strong>Stack alvo:</strong> ${escapeHtml(discovery.targetStack)}</div>
    <div class="header-meta-item"><strong>Legado:</strong> <code style="opacity:.8;font-size:12px">${escapeHtml(discovery.legacyPath)}</code></div>
    <div class="header-meta-item"><strong>Gerado em:</strong> ${generatedAt}</div>
    <div class="header-meta-item"><span class="status-pill status-done">✓ Discovery DONE</span></div>
  </div>
</div>

<div class="stats-bar">
  <div class="stat-tile">
    <div class="stat-number">${discovery.findings.length}</div>
    <div class="stat-label">Achados totais</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number stat-red">${blockers.length}</div>
    <div class="stat-label">Bloqueadores</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number stat-orange">${migrateFix.length}</div>
    <div class="stat-label">Corrigir na reescrita</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number stat-blue">${document.length}</div>
    <div class="stat-label">Documentar</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number stat-red">${critical}</div>
    <div class="stat-label">Críticos</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number stat-orange">${high}</div>
    <div class="stat-label">Altos</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number stat-green">${discovery.specification ? discovery.specification.businessRules.length : 0}</div>
    <div class="stat-label">Regras extraídas</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number stat-green">${discovery.specification ? discovery.specification.domainEntities.length : 0}</div>
    <div class="stat-label">Entidades</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number" style="color:#8e44ad">${discovery.specification ? (discovery.specification.databaseRules ?? []).length : 0}</div>
    <div class="stat-label">Regras de BD</div>
  </div>
  <div class="stat-tile">
    <div class="stat-number" style="color:#e67e22">${discovery.specification ? (discovery.specification.excludedScope ?? []).length : 0}</div>
    <div class="stat-label">Excluídos</div>
  </div>
</div>

<nav class="nav">
  <button class="nav-btn active" onclick="showTab('resumo')">Resumo</button>
  <button class="nav-btn" onclick="showTab('achados')">Achados (${discovery.findings.length})</button>
  <button class="nav-btn" onclick="showTab('spec')">Especificação</button>
  <button class="nav-btn" onclick="showTab('raciocinio')">Raciocínio (${discovery.thinkRecords.length})</button>
</nav>

<div class="content">

  <!-- RESUMO -->
  <div id="tab-resumo" class="section active">
    <div class="summary-grid">
      <div class="summary-card">
        <h4>Achados por classificação</h4>
        <ul class="summary-list">
          <li><span>${badge('Bloqueador', '#c0392b')}</span><strong>${blockers.length} achados</strong></li>
          <li><span>${badge('Corrigir na reescrita', '#e67e22')}</span><strong>${migrateFix.length} achados</strong></li>
          <li><span>${badge('Documentar', '#3498db')}</span><strong>${document.length} achados</strong></li>
        </ul>
      </div>
      <div class="summary-card">
        <h4>Achados por severidade</h4>
        <ul class="summary-list">
          ${['critical','high','medium','low','info'].map(s => {
            const count = discovery.findings.filter(f => f.severity === s).length
            return `<li><span>${badge(s, severityColor(s))}</span><strong>${count}</strong></li>`
          }).join('')}
        </ul>
      </div>
      <div class="summary-card">
        <h4>Especificação extraída</h4>
        <ul class="summary-list">
          ${discovery.specification ? [
            ['Entidades de domínio', discovery.specification.domainEntities.length],
            ['Regras de negócio', discovery.specification.businessRules.length],
            ['Fluxos', discovery.specification.flows.length],
            ['Contratos externos', discovery.specification.externalContracts.length],
            ['Regras de banco', (discovery.specification.databaseRules ?? []).length],
            ['Módulos excluídos', (discovery.specification.excludedScope ?? []).length],
            ['Req. não-funcionais', discovery.specification.nonFunctional.length],
          ].map(([label, count]) => `<li><span>${label}</span><strong>${count}</strong></li>`).join('')
          : '<li><span class="empty">Especificação não disponível</span></li>'}
        </ul>
      </div>
      <div class="summary-card">
        <h4>Escopo analisado</h4>
        <ul class="scope-list">
          ${discovery.scope.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
    </div>

    ${blockers.length > 0 ? `
    <div class="card">
      <div class="section-title" style="color:#c0392b">⚠ Decisões de triage necessárias <span class="count-pill">${blockers.filter(b => !b.triageDecision).length} pendentes</span></div>
      ${blockers.map(b => `
        <div style="padding:12px 0;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            ${badge(b.severity, severityColor(b.severity))}
            <strong>${escapeHtml(b.title)}</strong>
            <span style="font-size:12px;color:#888;margin-left:8px">${escapeHtml(b.file)}</span>
          </div>
          <div>${b.triageDecision
            ? `${badge(resolutionLabel(b.triageDecision.resolution), '#27ae60')}`
            : badge('Pendente', '#c0392b')
          }</div>
        </div>`).join('')}
    </div>` : ''}
  </div>

  <!-- ACHADOS -->
  <div id="tab-achados" class="section">
    ${blockers.length ? `<div class="findings-group-title">${badge('Bloqueadores', '#c0392b')} — ${blockers.length} achados</div>
      ${blockers.map(findingCard).join('')}` : ''}
    ${migrateFix.length ? `<div class="findings-group-title">${badge('Corrigir na reescrita', '#e67e22')} — ${migrateFix.length} achados</div>
      ${migrateFix.map(findingCard).join('')}` : ''}
    ${document.length ? `<div class="findings-group-title">${badge('Documentar', '#3498db')} — ${document.length} achados</div>
      ${document.map(findingCard).join('')}` : ''}
    ${discovery.findings.length === 0 ? '<p class="empty">Nenhum achado registrado.</p>' : ''}
  </div>

  <!-- ESPECIFICAÇÃO -->
  <div id="tab-spec" class="section">
    ${specSection(discovery)}
  </div>

  <!-- RACIOCÍNIO -->
  <div id="tab-raciocinio" class="section">
    <p style="font-size:14px;color:#666;margin-bottom:20px">
      Registro do raciocínio do agente durante a análise — cada think record é uma etapa explícita de inferência sobre o código legado.
    </p>
    ${thinkRows || '<p class="empty">Nenhum think record registrado.</p>'}
  </div>

</div>

<script>
  function showTab(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
    document.getElementById('tab-' + id).classList.add('active')
    event.currentTarget.classList.add('active')
  }
</script>
</body>
</html>`
}

export async function handleGenerateDiscoveryHtml(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'discovery') {
    throw new Error(`generate_discovery_html requires a discovery session, got ${session.type}`)
  }

  if (session.status !== 'DONE') {
    throw new Error(`generate_discovery_html requires a DONE discovery session (status: ${session.status})`)
  }

  const discovery = session as DiscoverySession
  const generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })

  const html = buildHtml(discovery, generatedAt)

  const reportsDir = join(discovery.artifactsPath, 'modernization-reports')
  await mkdir(reportsDir, { recursive: true })
  const htmlPath = join(reportsDir, `discovery-${args.sessionId}.html`)
  await writeFile(htmlPath, html, 'utf-8')

  const projectName = discovery.legacyPath.split(/[\\/]/).pop() ?? discovery.legacyPath
  const spec = discovery.specification

  return {
    sessionId: args.sessionId,
    htmlPath,
    relativePath: `modernization-reports/discovery-${args.sessionId}.html`,
    summary: {
      project: projectName,
      targetStack: discovery.targetStack,
      totalFindings: discovery.findings.length,
      blockers: discovery.findings.filter(f => f.classification === 'BLOCKER').length,
      migrateAndFix: discovery.findings.filter(f => f.classification === 'MIGRATE_AND_FIX').length,
      document: discovery.findings.filter(f => f.classification === 'DOCUMENT').length,
      specItems: spec
        ? spec.domainEntities.length + spec.businessRules.length + spec.flows.length + spec.externalContracts.length +
          (spec.databaseRules ?? []).length
        : 0,
      thinkRecords: discovery.thinkRecords.length,
    },
    message: `Relatório HTML gerado em modernization-reports/discovery-${args.sessionId}.html. Abra no navegador para apresentar os resultados.`,
  }
}

export const generateDiscoveryHtmlToolDefinition = {
  name: 'modernization_generate_discovery_html',
  description:
    'Gera um relatório HTML auto-contido da sessão de discovery, para apresentação a equipes, clientes e stakeholders. ' +
    'Inclui: resumo executivo com estatísticas, todos os achados classificados (BLOCKER/MIGRATE_AND_FIX/DOCUMENT) ' +
    'com decisões de triage, especificação completa extraída (entidades, regras, fluxos, contratos), ' +
    'e o registro de raciocínio do agente. ' +
    'Requer sessão de discovery com status DONE. Não altera estado da sessão.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'ID da sessão de discovery (status DONE)' },
    },
    required: ['sessionId'],
  },
}
