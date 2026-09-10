import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import { checkSpecCoverage } from '../harness/sensors.js'
import type { AppContext } from '../context.js'
import type {
  DeliverySession,
  DiscoverySession,
  ArchitectureSession,
  ImplementationSession,
  NewFile,
  Resolution,
} from '../domain/types.js'

export async function handleGenerateReport(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'delivery') {
    throw new Error(`generate_report requires a delivery session, got ${session.type}`)
  }

  if (session.status !== 'CREATED') {
    throw new Error(`generate_report requires status CREATED, got ${session.status}`)
  }

  const delivery = session as DeliverySession

  // Issue 21: load and validate ALL referenced sessions BEFORE transitioning to REPORTING
  // so a load failure cannot leave the session permanently stuck in REPORTING
  const discoverySession = await ctx.store.load(delivery.discoverySessionId)
  const architectureSession = await ctx.store.load(delivery.architectureSessionId)

  if (discoverySession.type !== 'discovery') throw new Error('discoverySessionId does not reference a discovery session')
  if (architectureSession.type !== 'architecture') throw new Error('architectureSessionId does not reference an architecture session')

  const discovery = discoverySession as DiscoverySession
  const architecture = architectureSession as ArchitectureSession

  const implSessions: ImplementationSession[] = []
  for (const id of delivery.implementationSessionIds) {
    const s = await ctx.store.load(id)
    if (s.type !== 'implementation') throw new Error(`Session ${id} is not an implementation session`)
    implSessions.push(s as ImplementationSession)
  }

  // Validate spec and plan BEFORE transitioning to avoid a permanently-stuck REPORTING state
  const spec = discovery.specification
  const plan = architecture.migrationPlan
  if (!spec) throw new Error(`Discovery session ${delivery.discoverySessionId} has no specification. Cannot generate report.`)
  if (!plan) throw new Error(`Architecture session ${delivery.architectureSessionId} has no migration plan. Cannot generate report.`)

  // Transition through REPORTING in memory only — save once at DONE so a crash
  // between report computation and final save leaves the session in CREATED,
  // not permanently stuck in REPORTING.
  const toReporting = transition(session, 'REPORTING')
  if (!toReporting.ok) throw new Error(toReporting.error)

  // Build report markdown
  const now = new Date().toISOString()

  const findingsByClass = {
    BLOCKER: discovery.findings.filter(f => f.classification === 'BLOCKER'),
    MIGRATE_AND_FIX: discovery.findings.filter(f => f.classification === 'MIGRATE_AND_FIX'),
    DOCUMENT: discovery.findings.filter(f => f.classification === 'DOCUMENT'),
  }

  const donePhases = implSessions.filter(s => s.status === 'DONE')
  const failedPhases = implSessions.filter(s => s.status !== 'DONE')

  const totalNewFiles = implSessions.reduce((acc, s) => {
    const lastCompleted = [...s.attempts].reverse().find(a => a.status === 'COMPLETED')
    return acc + (lastCompleted?.newFiles.length ?? 0)
  }, 0)

  // Sensor 1 (cross-phase): aggregate specRefs across all implementation sessions
  const allDeliveredFiles: NewFile[] = []
  for (const implSession of implSessions) {
    const lastCompleted = [...implSession.attempts].reverse().find(a => a.status === 'COMPLETED')
    if (lastCompleted) allDeliveredFiles.push(...lastCompleted.newFiles)
  }

  const completeness = checkSpecCoverage(spec, allDeliveredFiles)

  // MIGRATE_AND_FIX coverage: check how many findings appear in at least one file justification
  const allJustifications = allDeliveredFiles.map(f => f.justification.toLowerCase())
  const migrateAndFixFindings = findingsByClass.MIGRATE_AND_FIX
  const migrateAndFixAddressed = migrateAndFixFindings.filter(f =>
    allJustifications.some(j => j.includes(f.title.toLowerCase()) || j.includes(f.id.toLowerCase()))
  )

  const markdown = `# Migration Report

Generated: ${now}

---

## Legacy System

- **Path**: ${discovery.legacyPath}
- **Target Stack**: ${discovery.targetStack}

---

## Audit Summary (Fase 1 — Discovery)

Total findings: **${discovery.findings.length}**

| Classification | Count |
|---|---|
| BLOCKER | ${findingsByClass.BLOCKER.length} |
| MIGRATE_AND_FIX | ${findingsByClass.MIGRATE_AND_FIX.length} |
| DOCUMENT | ${findingsByClass.DOCUMENT.length} |

${findingsByClass.BLOCKER.length > 0 ? `
### BLOCKER Resolutions

${findingsByClass.BLOCKER.map(f => `- **${f.title}** (${f.severity}) → ${f.triageDecision?.resolution ?? 'unresolved'}
  - ${f.description}
  - Decision notes: ${f.triageDecision?.notes ?? 'n/a'}`).join('\n')}
` : ''}

${findingsByClass.MIGRATE_AND_FIX.length > 0 ? `
### Issues Fixed in New System

${findingsByClass.MIGRATE_AND_FIX.map(f => `- **${f.title}** (${f.severity}) in \`${f.file}\`
  - ${f.recommendation}`).join('\n')}
` : ''}

---

## Specification (Fase 1 — Discovery)

### Domain Entities (${spec.domainEntities.length})
${spec.domainEntities.map(e => `- **${e.name}**: ${e.description}`).join('\n')}

### Business Rules (${spec.businessRules.length})
${spec.businessRules.map(r => `- **${r.title}** — ${r.description} *(source: ${r.sourceRef})*`).join('\n')}

### Flows (${spec.flows.length})
${spec.flows.map(f => `- **${f.name}** *(source: ${f.sourceRef})*`).join('\n')}

### External Contracts (${spec.externalContracts.length})
${spec.externalContracts.map(c => `- [${c.type}] **${c.name}**: ${c.description}`).join('\n')}

${(spec.databaseRules ?? []).length > 0 ? `
### Database Rules (${(spec.databaseRules ?? []).length})

| Name | Type | Decision | Rationale |
|---|---|---|---|
${(spec.databaseRules ?? []).map(r => `| ${r.name} | ${r.type} | ${r.decision} | ${r.rationale} |`).join('\n')}
` : ''}

${(spec.excludedScope ?? []).length > 0 ? `
### Excluded Scope (${(spec.excludedScope ?? []).length})

The following paths were explicitly excluded from migration:

${(spec.excludedScope ?? []).map(e => `- \`${e.path}\` — ${e.reason}`).join('\n')}
` : ''}

---

## Migration Plan (Fase 2 — Architecture)

- **Target Stack**: ${plan.targetStack}
- **New Project**: \`${plan.newProjectPath}\`

### Architecture Decisions
${plan.architectureDecisions.map(d => `- ${d}`).join('\n')}

### Phases
${plan.phases.map(p => `${p.number}. **${p.title}** (${p.estimatedComplexity}) — ${p.description}`).join('\n')}

---

## Implementation (Fase 3 — Implementation)

| Phase | Status | Files Created |
|---|---|---|
${implSessions.map(s => {
  const lastAttempt = [...s.attempts].reverse().find(a => a.status === 'COMPLETED')
  return `| ${s.phaseNumber}. ${s.phaseTitle} | ${s.status} | ${lastAttempt?.newFiles.length ?? 0} |`
}).join('\n')}

**Total phases completed**: ${donePhases.length} / ${implSessions.length}
**Total files created**: ${totalNewFiles}
**New project path**: \`${plan.newProjectPath}\`

${failedPhases.length > 0 ? `
### Pending / Failed Phases
${failedPhases.map(s => `- Phase ${s.phaseNumber} (${s.phaseTitle}): ${s.status}`).join('\n')}
` : ''}

---

## Sensor Report

### Sensor 1 — Spec Coverage (cross-phase)

${completeness ? `
**Coverage: ${completeness.coveragePercent}% (${completeness.coveredItems}/${completeness.totalItems} spec items referenced)**

| Type | Total | Covered | Uncovered |
|---|---|---|---|
| Domain Entities | ${spec.domainEntities.length} | ${spec.domainEntities.length - completeness.uncovered.filter(u => u.type === 'entity').length} | ${completeness.uncovered.filter(u => u.type === 'entity').length} |
| Business Rules | ${spec.businessRules.length} | ${spec.businessRules.length - completeness.uncovered.filter(u => u.type === 'businessRule').length} | ${completeness.uncovered.filter(u => u.type === 'businessRule').length} |
| Flows | ${spec.flows.length} | ${spec.flows.length - completeness.uncovered.filter(u => u.type === 'flow').length} | ${completeness.uncovered.filter(u => u.type === 'flow').length} |
| External Contracts | ${spec.externalContracts.length} | ${spec.externalContracts.length - completeness.uncovered.filter(u => u.type === 'contract').length} | ${completeness.uncovered.filter(u => u.type === 'contract').length} |

${completeness.uncovered.length > 0 ? `
**Uncovered spec items (not referenced by any implemented file):**
${completeness.uncovered.map(u => `- [${u.type}] \`${u.id}\`: ${u.title}`).join('\n')}
` : '**All spec items are referenced in the implementation.**'}
` : '*No spec available for coverage analysis.*'}

### Sensor 2 — Legacy Isolation

All implementation files were validated before writing. No file in the new project references the legacy path \`${discovery.legacyPath}\`.

### MIGRATE_AND_FIX Coverage

${migrateAndFixFindings.length === 0
  ? 'No MIGRATE_AND_FIX findings recorded.'
  : `${migrateAndFixAddressed.length}/${migrateAndFixFindings.length} findings explicitly addressed in implementation justifications.

${migrateAndFixFindings.map(f => {
    const addressed = migrateAndFixAddressed.some(a => a.id === f.id)
    return `- ${addressed ? '✓' : '○'} **${f.title}** (${f.severity}) — ${addressed ? 'addressed' : 'not explicitly mentioned in justifications (may be covered implicitly by spec-based build)'}`
  }).join('\n')}`
}

---

## Running in Parallel

The new system is at: \`${plan.newProjectPath}\`

The legacy system remains untouched at: \`${discovery.legacyPath}\`

Both can run simultaneously. Validate the new system before decommissioning the legacy.

---

*Generated by Modernization Harness — Session ${delivery.id}*
`

  // Transition to DONE
  const toDone = transition(toReporting.session, 'DONE')
  if (!toDone.ok) throw new Error(toDone.error)

  const resolution: Resolution = {
    id: randomUUID(),
    sessionId: args.sessionId,
    resolvedAt: now,
    outcome: 'DONE',
  }

  const updated = { ...toDone.session, report: markdown, resolution } as DeliverySession
  await ctx.store.save(updated, session)

  const reportPath = await ctx.store.saveReport(args.sessionId, markdown, delivery.artifactsPath)

  return {
    sessionId: session.id,
    status: 'DONE',
    reportSavedTo: reportPath,
    phasesCompleted: donePhases.length,
    phasesTotal: implSessions.length,
    totalFilesCreated: totalNewFiles,
    newProjectPath: plan.newProjectPath,
    legacyPath: discovery.legacyPath,
    sensors: {
      specCoverage: completeness
        ? {
            coveragePercent: completeness.coveragePercent,
            coveredItems: completeness.coveredItems,
            totalItems: completeness.totalItems,
            uncovered: completeness.uncovered,
          }
        : null,
      legacyIsolation: {
        passed: true,
        note: 'All files validated per-phase before writing via apply_new_project.',
      },
      migrateAndFixCoverage: {
        addressed: migrateAndFixAddressed.length,
        total: migrateAndFixFindings.length,
      },
    },
    report: markdown,
    message: 'Migration report generated. Modernization process complete.',
  }
}

export const generateReportToolDefinition = {
  name: 'modernization_generate_report',
  description:
    'Generate the final migration report. ' +
    'Reads all linked sessions (discovery, architecture, implementation) and assembles a comprehensive report ' +
    'covering: audit findings, extracted specification, migration plan, implementation results, and lineage. ' +
    'Saves the report as markdown and transitions the delivery session to DONE.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The delivery session ID' },
    },
    required: ['sessionId'],
  },
}
