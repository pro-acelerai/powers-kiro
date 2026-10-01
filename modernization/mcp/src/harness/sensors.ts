import type { Specification, NewFile } from '../domain/types.js'

// --- Sensor 1: Spec Coverage ---

export interface UncoveredItem {
  type: 'entity' | 'businessRule' | 'flow' | 'contract'
  id: string
  title: string
}

export interface SpecCoverageResult {
  totalItems: number
  coveredItems: number
  coveragePercent: number
  uncovered: UncoveredItem[]
}

export function checkSpecCoverage(spec: Specification, newFiles: NewFile[]): SpecCoverageResult {
  const allSpecRefs = new Set(newFiles.flatMap(f => f.specRefs))

  const uncovered: UncoveredItem[] = []

  for (const e of spec.domainEntities) {
    if (!allSpecRefs.has(e.name)) {
      uncovered.push({ type: 'entity', id: e.name, title: e.name })
    }
  }
  for (const r of spec.businessRules) {
    if (!allSpecRefs.has(r.id)) {
      uncovered.push({ type: 'businessRule', id: r.id, title: r.title })
    }
  }
  for (const f of spec.flows) {
    if (!allSpecRefs.has(f.id)) {
      uncovered.push({ type: 'flow', id: f.id, title: f.name })
    }
  }
  for (const c of spec.externalContracts) {
    if (!allSpecRefs.has(c.id)) {
      uncovered.push({ type: 'contract', id: c.id, title: c.name })
    }
  }
  // Only track DB rules that must be reimplemented in application code — those
  // are the ones the implementation agent is responsible for covering.
  for (const r of (spec.databaseRules ?? [])) {
    if (r.decision === 'reimplement_in_application' && !allSpecRefs.has(r.id)) {
      uncovered.push({ type: 'businessRule', id: r.id, title: `[DB rule] ${r.name}` })
    }
  }

  const reimplementDbRules = (spec.databaseRules ?? []).filter(r => r.decision === 'reimplement_in_application').length

  const totalItems =
    spec.domainEntities.length +
    spec.businessRules.length +
    spec.flows.length +
    spec.externalContracts.length +
    reimplementDbRules

  const coveredItems = totalItems - uncovered.length
  const coveragePercent = totalItems > 0 ? Math.round((coveredItems / totalItems) * 100) : 100

  return { totalItems, coveredItems, coveragePercent, uncovered }
}

// --- Sensor 2: Legacy Isolation ---

export interface IsolationViolation {
  file: string
  reason: string
}

export interface LegacyIsolationResult {
  passed: boolean
  violations: IsolationViolation[]
}

export function checkLegacyIsolation(newFiles: NewFile[], legacyPath: string): LegacyIsolationResult {
  const violations: IsolationViolation[] = []

  // Normalize both slash styles for cross-platform matching
  const forward = legacyPath.replace(/\\/g, '/').toLowerCase()
  const backward = legacyPath.replace(/\//g, '\\').toLowerCase()

  for (const newFile of newFiles) {
    const contentLower = newFile.content.toLowerCase()

    const matchesForward = forward.length > 3 && contentLower.includes(forward)
    const matchesBackward = backward !== forward && backward.length > 3 && contentLower.includes(backward)

    if (matchesForward || matchesBackward) {
      violations.push({
        file: newFile.file,
        reason: `File content references the legacy path "${legacyPath}". New project must be fully independent.`,
      })
    }
  }

  return { passed: violations.length === 0, violations }
}

// --- Sensor report helpers ---

export function formatCoverageWarning(result: SpecCoverageResult): string {
  if (result.uncovered.length === 0) return ''

  const lines = [
    `⚠ Spec coverage: ${result.coveragePercent}% (${result.coveredItems}/${result.totalItems} items referenced).`,
    `Uncovered spec items (add specRefs to the relevant files):`,
    ...result.uncovered.map(u => `  - [${u.type}] ${u.id}: ${u.title}`),
  ]
  return lines.join('\n')
}

export function formatIsolationError(result: LegacyIsolationResult): string {
  if (result.passed) return ''

  const lines = [
    `Legacy isolation violation — ${result.violations.length} file(s) reference the legacy project:`,
    ...result.violations.map(v => `  - ${v.file}\n    ${v.reason}`),
    `Fix these files and resubmit before applying.`,
  ]
  return lines.join('\n')
}
