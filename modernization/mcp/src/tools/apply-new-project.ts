import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { transition } from '../domain/state-machine.js'
import {
  checkLegacyIsolation,
  checkSpecCoverage,
  formatCoverageWarning,
  formatIsolationError,
} from '../harness/sensors.js'
import type { AppContext } from '../context.js'
import type { DiscoverySession, ImplementationSession } from '../domain/types.js'

function getCurrentAttempt(session: ImplementationSession) {
  return session.attempts.find(a => a.status === 'IN_PROGRESS') ?? null
}

export async function handleApplyNewProject(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'implementation') {
    throw new Error(`apply_new_project requires an implementation session, got ${session.type}`)
  }

  const allowedStatuses = ['BUILDING', 'CORRECTING'] as const
  if (!allowedStatuses.includes(session.status as typeof allowedStatuses[number])) {
    throw new Error(`apply_new_project requires status BUILDING or CORRECTING, got ${session.status}`)
  }

  const impl = session as ImplementationSession
  const attempt = getCurrentAttempt(impl)

  if (!attempt) {
    throw new Error('No IN_PROGRESS attempt found. Submit files first via submit_new_file.')
  }

  if (attempt.newFiles.length === 0) {
    throw new Error('No files queued in current attempt. Call submit_new_file first.')
  }

  // Load discovery session for sensors
  const discoverySession = await ctx.store.load(impl.discoverySessionId)
  if (discoverySession.type !== 'discovery') {
    throw new Error('Discovery session not found or wrong type')
  }
  const discovery = discoverySession as DiscoverySession

  // Sensor 2: Legacy isolation — BLOCKER
  const isolation = checkLegacyIsolation(attempt.newFiles, discovery.legacyPath)
  if (!isolation.passed) {
    throw new Error(formatIsolationError(isolation))
  }

  // Sensor 1: Spec coverage — WARNING (does not block)
  const spec = discovery.specification
  const coverage = spec ? checkSpecCoverage(spec, attempt.newFiles) : null
  const coverageWarning = coverage ? formatCoverageWarning(coverage) : ''

  const writtenFiles: string[] = []

  try {
    for (const newFile of attempt.newFiles) {
      await mkdir(dirname(newFile.file), { recursive: true })
      await writeFile(newFile.file, newFile.content, 'utf-8')
      writtenFiles.push(newFile.file)
    }
  } catch (err) {
    // Rollback: remove files written so far to avoid partial/inconsistent project state
    for (const written of writtenFiles) {
      try { await unlink(written) } catch { /* best-effort */ }
    }
    throw new Error(`Failed to write project files: ${err instanceof Error ? err.message : String(err)}`)
  }

  const transResult = transition(session, 'APPLYING')
  if (!transResult.ok) throw new Error(transResult.error)

  const updatedAttempts = impl.attempts.map(a =>
    a.id === attempt.id ? attempt : a
  )
  const updated = { ...transResult.session, attempts: updatedAttempts } as ImplementationSession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'APPLYING',
    newProjectPath: impl.newProjectPath,
    writtenFiles,
    totalFiles: writtenFiles.length,
    attemptNumber: attempt.attemptNumber,
    sensors: {
      legacyIsolation: { passed: true },
      specCoverage: coverage
        ? {
            coveragePercent: coverage.coveragePercent,
            coveredItems: coverage.coveredItems,
            totalItems: coverage.totalItems,
            uncoveredCount: coverage.uncovered.length,
            uncovered: coverage.uncovered,
          }
        : null,
    },
    warnings: coverageWarning ? [coverageWarning] : [],
    message:
      `Wrote ${writtenFiles.length} file(s) to ${impl.newProjectPath}. ` +
      (coverageWarning ? `\n\n${coverageWarning}\n\n` : '') +
      `Call run_lint to validate.`,
  }
}

export const applyNewProjectToolDefinition = {
  name: 'modernization_apply_new_project',
  description:
    'Write all queued new files to the new project directory. ' +
    'Creates directories as needed. Does not touch the legacy project. ' +
    'Transitions to APPLYING. Call run_lint after this.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The implementation session ID' },
    },
    required: ['sessionId'],
  },
}
