import type { AppContext } from '../context.js'
import type { ExecutionSession, AnalysisSession, FileChange } from '../domain/types.js'
import { checkIssueCoverage } from '../harness/sensors.js'

export async function handleGenerateReport(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'execution') {
    throw new Error(`upgrade_generate_report requires an execution session, got ${session.type}`)
  }

  if (session.status !== 'DONE') {
    throw new Error(`upgrade_generate_report requires status DONE, got ${session.status}`)
  }

  const exec = session as ExecutionSession

  const analysisSession = await ctx.store.load(exec.analysisSessionId)
  if (analysisSession.type !== 'analysis') {
    throw new Error('analysisSessionId does not reference an analysis session')
  }
  const analysis = analysisSession as AnalysisSession

  const now = new Date().toISOString()

  // Aggregate all file changes across completed attempts
  const allFileChanges: FileChange[] = []
  for (const attempt of exec.attempts) {
    if (attempt.status === 'COMPLETED') {
      allFileChanges.push(...attempt.fileChanges)
    }
  }

  const lastCompletedAttempt = [...exec.attempts].reverse().find(a => a.status === 'COMPLETED')
  const validationResult = lastCompletedAttempt?.validationResult ?? null

  // Sensor 1: issue coverage across all attempts
  const coverage = checkIssueCoverage(analysis.issues, allFileChanges)

  // Issues by type and severity
  const byType = analysis.issues.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const bySeverity = analysis.issues.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const mustFixCount = analysis.issues.filter(i => i.status === 'must_fix').length
  const recommendedCount = analysis.issues.filter(i => i.status === 'recommended').length
  const optionalCount = analysis.issues.filter(i => i.status === 'optional').length

  const markdown = `# Upgrade Report

Generated: ${now}

---

## Upgrade Summary

- **Project**: \`${exec.projectPath}\`
- **Upgrade Target**: ${exec.upgradeTarget}
- **Validation Command**: \`${exec.validationCommand || 'none'}\`
- **Execution Session**: ${exec.id}
- **Analysis Session**: ${exec.analysisSessionId}

---

## Issues Found (Phase: Analysis)

Total issues: **${analysis.issues.length}**

| Status | Count |
|---|---|
| must_fix | ${mustFixCount} |
| recommended | ${recommendedCount} |
| optional | ${optionalCount} |

### By Severity

| Severity | Count |
|---|---|
${Object.entries(bySeverity).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

### By Type

| Type | Count |
|---|---|
${Object.entries(byType).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

${analysis.issues.length > 0 ? `
### Issue List

${analysis.issues.map(i =>
  `- **[${i.status}]** [${i.severity}] \`${i.file}${i.line ? `:${i.line}` : ''}\` — ${i.title}\n  - ${i.description}\n  - Recommendation: ${i.recommendation}`
).join('\n')}
` : ''}

---

## Upgrade Plan

${analysis.plan ? `
- **Plan Version**: ${analysis.plan.version}
- **Upgrade Target**: ${analysis.plan.upgradeTarget}
- **Reasoning**: ${analysis.plan.reasoning}

### Planned Changes (${analysis.plan.changes.length})

| File | Description | Risk | Issues |
|---|---|---|---|
${analysis.plan.changes.map(c =>
  `| \`${c.file}\` | ${c.description} | ${c.riskLevel} | ${c.issueRefs.join(', ') || 'none'} |`
).join('\n')}
` : '*No plan available.*'}

---

## Execution Results

**Attempts used**: ${exec.attempts.length} / ${exec.correctionBudget}

${exec.attempts.map(a => {
  const vr = a.validationResult
  return `### Attempt #${a.attemptNumber} (${a.status})

- Started: ${a.createdAt}
- Completed: ${a.completedAt ?? 'N/A'}
- File changes: ${a.fileChanges.length}
${vr ? `- Lint: ${vr.lintStatus}
- Validation command: ${vr.commandStatus}
${vr.failureEvidence.length > 0 ? `- Lint failures: ${vr.failureEvidence.length}` : ''}` : ''}
`}).join('\n')}

### Final Validation

- **Lint status**: ${validationResult?.lintStatus ?? 'N/A'}
- **Command status**: ${validationResult?.commandStatus ?? 'N/A'}
${validationResult?.rawCommandOutput ? `
<details>
<summary>Command output</summary>

\`\`\`
${validationResult.rawCommandOutput}
\`\`\`

</details>
` : ''}

---

## Sensor Report

### Sensor 1 — Issue Coverage (must_fix)

**Coverage: ${coverage.coveragePercent}% (${coverage.coveredMustFix}/${coverage.totalMustFix} must_fix issues addressed)**

${coverage.uncovered.length > 0 ? `
**Uncovered must_fix issues:**
${coverage.uncovered.map(i => `- [${i.type}] \`${i.id}\`: ${i.title}`).join('\n')}
` : coverage.totalMustFix > 0 ? '**All must_fix issues were addressed in the implementation.**' : '*No must_fix issues recorded.*'}

### Sensor 2 — Scope Isolation

All file changes were validated against the authorized scope before writing.

---

## Files Changed

${lastCompletedAttempt && lastCompletedAttempt.fileChanges.length > 0 ? `
| Operation | File |
|---|---|
${lastCompletedAttempt.fileChanges.map(fc => `| ${fc.operation} | \`${fc.file}\` |`).join('\n')}
` : '*No files changed in the final attempt.*'}

---

*Generated by Upgrade Harness — Session ${exec.id}*
`

  const reportPath = await ctx.store.saveReport(exec.artifactsPath, exec.id, markdown)

  return {
    sessionId: exec.id,
    status: 'DONE',
    reportPath,
    summary: {
      projectPath: exec.projectPath,
      upgradeTarget: exec.upgradeTarget,
      totalIssues: analysis.issues.length,
      mustFixIssues: mustFixCount,
      issueCoverage: coverage.coveragePercent,
      attemptsUsed: exec.attempts.length,
      correctionBudget: exec.correctionBudget,
      lintStatus: validationResult?.lintStatus ?? 'N/A',
      commandStatus: validationResult?.commandStatus ?? 'N/A',
      filesChanged: lastCompletedAttempt?.fileChanges.length ?? 0,
    },
    message: `Upgrade report generated and saved to ${reportPath}.`,
  }
}

export const generateReportToolDefinition = {
  name: 'upgrade_generate_report',
  description:
    'Generate the final upgrade report for a completed execution session. ' +
    'Reads linked analysis session data and assembles a comprehensive report covering: ' +
    'found issues, upgrade plan, execution attempts, validation results, and sensor data. ' +
    'Saves the report as markdown. Does not change session state (call after DONE).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The execution session ID (must be in DONE status)' },
    },
    required: ['sessionId'],
  },
}
