import type { Issue, FileChange } from '../domain/types.js'
import { isInScope } from './scope.js'

// --- Sensor 1: Issue Coverage ---

export interface IssueCoverageResult {
  totalMustFix: number
  coveredMustFix: number
  coveragePercent: number
  uncovered: Issue[]
}

export function checkIssueCoverage(issues: Issue[], fileChanges: FileChange[]): IssueCoverageResult {
  const mustFixIssues = issues.filter(i => i.status === 'must_fix')
  const allIssueRefs = new Set(fileChanges.flatMap(fc => fc.issueRefs))

  const uncovered = mustFixIssues.filter(i => !allIssueRefs.has(i.id))

  const totalMustFix = mustFixIssues.length
  const coveredMustFix = totalMustFix - uncovered.length
  const coveragePercent = totalMustFix > 0 ? Math.round((coveredMustFix / totalMustFix) * 100) : 100

  return { totalMustFix, coveredMustFix, coveragePercent, uncovered }
}

// --- Sensor 2: Scope Isolation ---

export interface ScopeViolation {
  file: string
  reason: string
}

export interface ScopeViolationResult {
  passed: boolean
  violations: ScopeViolation[]
}

export function checkScopeViolations(fileChanges: FileChange[], scope: string[]): ScopeViolationResult {
  const violations: ScopeViolation[] = []

  for (const fc of fileChanges) {
    if (!isInScope(fc.file, scope)) {
      violations.push({
        file: fc.file,
        reason: `File "${fc.file}" is outside the declared scope. Only files within the authorized scope may be modified.`,
      })
    }
  }

  return { passed: violations.length === 0, violations }
}

// --- Sensor report helpers ---

export function formatCoverageWarning(result: IssueCoverageResult): string {
  if (result.uncovered.length === 0) return ''

  const lines = [
    `Warning: issue coverage ${result.coveragePercent}% (${result.coveredMustFix}/${result.totalMustFix} must_fix issues addressed).`,
    `Uncovered must_fix issues (add issueRefs to relevant file changes):`,
    ...result.uncovered.map(i => `  - [${i.type}] ${i.id}: ${i.title}`),
  ]
  return lines.join('\n')
}

export function formatScopeError(result: ScopeViolationResult): string {
  if (result.passed) return ''

  const lines = [
    `Scope violation — ${result.violations.length} file(s) outside authorized scope:`,
    ...result.violations.map(v => `  - ${v.file}\n    ${v.reason}`),
    `Fix these violations before applying changes.`,
  ]
  return lines.join('\n')
}
