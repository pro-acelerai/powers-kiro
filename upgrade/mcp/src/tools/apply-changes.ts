import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { transition } from '../domain/state-machine.js'
import {
  checkIssueCoverage,
  checkScopeViolations,
  formatCoverageWarning,
  formatScopeError,
} from '../harness/sensors.js'
import type { AppContext } from '../context.js'
import type { ExecutionSession, AnalysisSession } from '../domain/types.js'
import { getCurrentAttempt } from './attempt-utils.js'

export async function handleApplyChanges(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'execution') {
    throw new Error(`upgrade_apply_changes requires an execution session, got ${session.type}`)
  }

  const allowedStatuses = ['LOADING', 'CORRECTING'] as const
  if (!allowedStatuses.includes(session.status as typeof allowedStatuses[number])) {
    throw new Error(`upgrade_apply_changes requires status LOADING or CORRECTING, got ${session.status}`)
  }

  const exec = session as ExecutionSession
  const attempt = getCurrentAttempt(exec)

  if (!attempt) {
    throw new Error('No IN_PROGRESS attempt found. Submit file changes first via upgrade_submit_file_change.')
  }

  if (attempt.fileChanges.length === 0) {
    throw new Error('No file changes queued in current attempt. Call upgrade_submit_file_change first.')
  }

  // Load analysis session to get issues for sensor 1
  const analysisSession = await ctx.store.load(exec.analysisSessionId)
  if (analysisSession.type !== 'analysis') {
    throw new Error('Analysis session not found or wrong type')
  }
  const analysis = analysisSession as AnalysisSession

  // Sensor 2: Scope violations — BLOCKER
  const scopeResult = checkScopeViolations(attempt.fileChanges, exec.scope)
  if (!scopeResult.passed) {
    throw new Error(formatScopeError(scopeResult))
  }

  // Sensor 1: Issue coverage — WARNING (does not block)
  const coverage = checkIssueCoverage(analysis.issues, attempt.fileChanges)
  const coverageWarning = formatCoverageWarning(coverage)

  const writtenFiles: string[] = []

  try {
    for (const fc of attempt.fileChanges) {
      if (fc.operation === 'delete') {
        try { await unlink(fc.file) } catch { /* file may already not exist */ }
        writtenFiles.push(fc.file)
      } else {
        await mkdir(dirname(fc.file), { recursive: true })
        await writeFile(fc.file, fc.content, 'utf-8')
        writtenFiles.push(fc.file)
      }
    }
  } catch (err) {
    // Rollback: attempt to restore original content for modified files
    for (const written of writtenFiles) {
      const fc = attempt.fileChanges.find(c => c.file === written)
      if (!fc) continue
      try {
        if (fc.operation === 'delete' && fc.originalContent !== null) {
          await writeFile(fc.file, fc.originalContent, 'utf-8')
        } else if (fc.operation !== 'delete') {
          await unlink(fc.file)
        }
      } catch { /* best-effort */ }
    }
    throw new Error(`Failed to apply changes: ${err instanceof Error ? err.message : String(err)}`)
  }

  const transResult = transition(session, 'APPLYING')
  if (!transResult.ok) throw new Error(transResult.error)

  const updatedAttempts = exec.attempts.map(a =>
    a.id === attempt.id ? attempt : a
  )
  const updated = { ...transResult.session, attempts: updatedAttempts } as ExecutionSession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'APPLYING',
    projectPath: exec.projectPath,
    writtenFiles,
    totalFiles: writtenFiles.length,
    attemptNumber: attempt.attemptNumber,
    sensors: {
      scopeIsolation: { passed: true },
      issueCoverage: {
        coveragePercent: coverage.coveragePercent,
        coveredMustFix: coverage.coveredMustFix,
        totalMustFix: coverage.totalMustFix,
        uncoveredCount: coverage.uncovered.length,
        uncovered: coverage.uncovered,
      },
    },
    warnings: coverageWarning ? [coverageWarning] : [],
    message:
      `Applied ${writtenFiles.length} file change(s) to ${exec.projectPath}. ` +
      (coverageWarning ? `\n\n${coverageWarning}\n\n` : '') +
      `Call upgrade_run_validation to validate.`,
  }
}

export const applyChangesToolDefinition = {
  name: 'upgrade_apply_changes',
  description:
    'Write all queued file changes to the project directory in-place. ' +
    'Checks scope violations (blocker) and issue coverage (warning). ' +
    'Transitions to APPLYING. Call upgrade_run_validation after this.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The execution session ID' },
    },
    required: ['sessionId'],
  },
}
