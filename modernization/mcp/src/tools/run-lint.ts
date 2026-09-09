import { randomUUID } from 'node:crypto'
import { runLint } from '../harness/lint-runner.js'
import { transition, canAttemptCorrection } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { ImplementationSession, Resolution } from '../domain/types.js'

function getCurrentAttempt(session: ImplementationSession) {
  return session.attempts.find(a => a.status === 'IN_PROGRESS') ?? null
}

export async function handleRunLint(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'implementation') {
    throw new Error(`run_lint requires an implementation session, got ${session.type}`)
  }

  if (session.status !== 'APPLYING') {
    throw new Error(`run_lint requires status APPLYING, got ${session.status}`)
  }

  const impl = session as ImplementationSession
  const attempt = getCurrentAttempt(impl)

  if (!attempt) {
    throw new Error('No IN_PROGRESS attempt found. Apply the project first via apply_new_project.')
  }

  // Transition to VALIDATING first
  const toValidating = transition(session, 'VALIDATING')
  if (!toValidating.ok) throw new Error(toValidating.error)

  const filesToLint = attempt.newFiles
    .filter(f => f.operation !== 'modify' || f.content)
    .map(f => f.file)
    .filter(f => /\.[jt]sx?$/.test(f))

  const verificationResult = await runLint(filesToLint, attempt.id, impl.newProjectPath)

  const now = new Date().toISOString()

  // Complete the attempt with verification result
  const completedAttempt = {
    ...attempt,
    completedAt: now,
    status: 'COMPLETED' as const,
    verificationResult,
  }

  const otherAttempts = impl.attempts.filter(a => a.id !== attempt.id)
  const allAttempts = [...otherAttempts, completedAttempt]

  if (verificationResult.status === 'PASS' || verificationResult.status === 'SKIPPED') {
    const toDone = transition(toValidating.session, 'DONE')
    if (!toDone.ok) throw new Error(toDone.error)

    const resolution: Resolution = {
      id: randomUUID(),
      sessionId: args.sessionId,
      resolvedAt: now,
      outcome: 'DONE',
    }

    const updated = {
      ...toDone.session,
      attempts: allAttempts,
      resolution,
    } as ImplementationSession
    await ctx.store.save(updated, session)

    return {
      sessionId: session.id,
      status: 'DONE',
      lintStatus: verificationResult.status,
      attemptNumber: completedAttempt.attemptNumber,
      message: `Lint passed. Phase ${impl.phaseNumber} (${impl.phaseTitle}) is DONE.`,
    }
  }

  // Lint failed
  const tempSession = { ...toValidating.session, attempts: allAttempts } as ImplementationSession

  if (!canAttemptCorrection(tempSession)) {
    const toBudget = transition(toValidating.session, 'BUDGET_EXCEEDED')
    if (!toBudget.ok) throw new Error(toBudget.error)

    const resolution: Resolution = {
      id: randomUUID(),
      sessionId: args.sessionId,
      resolvedAt: now,
      outcome: 'BUDGET_EXCEEDED',
    }

    const updated = {
      ...toBudget.session,
      attempts: allAttempts,
      resolution,
    } as ImplementationSession
    await ctx.store.save(updated, session)

    return {
      sessionId: session.id,
      status: 'BUDGET_EXCEEDED',
      lintStatus: verificationResult.status,
      attemptsUsed: allAttempts.length,
      correctionBudget: impl.correctionBudget,
      failureEvidence: verificationResult.failureEvidence,
      message: 'Lint failed and correction budget exhausted. Session ended as BUDGET_EXCEEDED.',
    }
  }

  // Can correct
  const toCorrection = transition(toValidating.session, 'CORRECTING')
  if (!toCorrection.ok) throw new Error(toCorrection.error)

  const updated = { ...toCorrection.session, attempts: allAttempts } as ImplementationSession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'CORRECTING',
    lintStatus: verificationResult.status,
    attemptNumber: completedAttempt.attemptNumber,
    attemptsRemaining: impl.correctionBudget - allAttempts.length,
    failureEvidence: verificationResult.failureEvidence,
    message:
      `Lint failed with ${verificationResult.failureEvidence.length} issue(s). ` +
      `${impl.correctionBudget - allAttempts.length} correction attempt(s) remaining. ` +
      `Fix the issues via submit_new_file and call apply_new_project + run_lint again.`,
  }
}

export const runLintToolDefinition = {
  name: 'modernization_run_lint',
  description:
    'Run ESLint on the new project files. ' +
    'If lint passes: session transitions to DONE — phase complete. ' +
    'If lint fails: session transitions to CORRECTING for another attempt (up to 3 total). ' +
    'If correction budget exhausted: session transitions to BUDGET_EXCEEDED.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The implementation session ID' },
    },
    required: ['sessionId'],
  },
}
