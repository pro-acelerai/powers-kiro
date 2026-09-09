import { randomUUID } from 'node:crypto'
import { runLint } from '../harness/lint-runner.js'
import { transition, canAttemptCorrection } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { Attempt, Resolution, Session } from '../domain/types.js'

export async function handleRunLint(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.status !== 'APPLYING') {
    throw new Error(`run_lint requires status APPLYING, got ${session.status}`)
  }

  const attempt = session.attempts.find(a => a.status === 'IN_PROGRESS')
  if (!attempt) throw new Error('No IN_PROGRESS attempt found.')

  // Transition APPLYING → VERIFYING (recorded in trace even if ESLint is instant)
  const toVerifying = transition(session, 'VERIFYING')
  if (!toVerifying.ok) throw new Error(toVerifying.error)

  const filesToLint = attempt.proposedChanges
    .filter(c => c.operation !== 'delete')
    .map(c => c.file)

  const verificationResult = await runLint(filesToLint, attempt.id, ctx.workspacePath)

  // Mark the attempt COMPLETED with verification result
  const completedAttempt: Attempt = {
    ...attempt,
    completedAt: new Date().toISOString(),
    status: 'COMPLETED',
    verificationResult,
  }

  const sessionAfterVerify: Session = {
    ...toVerifying.session,
    attempts: toVerifying.session.attempts.map(a =>
      a.id === completedAttempt.id ? completedAttempt : a
    ),
  }

  const passed =
    verificationResult.status === 'PASS' || verificationResult.status === 'SKIPPED'

  let nextStatus: 'DONE' | 'CORRECTING' | 'BUDGET_EXCEEDED'
  if (passed) {
    nextStatus = 'DONE'
  } else if (canAttemptCorrection(sessionAfterVerify)) {
    nextStatus = 'CORRECTING'
  } else {
    nextStatus = 'BUDGET_EXCEEDED'
  }

  const toFinal = transition(sessionAfterVerify, nextStatus)
  if (!toFinal.ok) throw new Error(toFinal.error)

  let finalSession: Session = toFinal.session

  if (nextStatus === 'DONE' || nextStatus === 'BUDGET_EXCEEDED') {
    const resolution: Resolution = {
      id: randomUUID(),
      sessionId: session.id,
      resolvedAt: new Date().toISOString(),
      outcome: nextStatus,
    }
    finalSession = { ...toFinal.session, resolution }
  }

  await ctx.store.save(finalSession, session)

  if (passed) {
    return {
      sessionId: session.id,
      status: 'DONE',
      message: 'Lint passed. Session is DONE. The trace has been saved to .kiro/trace/.',
    }
  }

  if (nextStatus === 'BUDGET_EXCEEDED') {
    return {
      sessionId: session.id,
      status: 'BUDGET_EXCEEDED',
      attempts: finalSession.attempts.length,
      correctionBudget: finalSession.correctionBudget,
      failureEvidence: verificationResult.failureEvidence,
      message:
        'Correction budget exhausted. Stop and inform the developer. ' +
        'The full attempt history is in the trace file for manual review.',
    }
  }

  return {
    sessionId: session.id,
    status: 'CORRECTING',
    attemptNumber: completedAttempt.attemptNumber,
    remainingAttempts: finalSession.correctionBudget - finalSession.attempts.length,
    failureEvidence: verificationResult.failureEvidence,
    message:
      'Lint failed. Analyze the failure evidence above and call submit_correction ' +
      'with the corrected file content, then call apply_changes.',
  }
}

export const runLintToolDefinition = {
  name: 'pro-coding_run_lint',
  description:
    'Run the linter on the applied changes. ' +
    'On pass: session moves to DONE. ' +
    'On fail: session moves to CORRECTING (budget permitting) or BUDGET_EXCEEDED.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID' },
    },
    required: ['sessionId'],
  },
}
