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

  const passed =
    verificationResult.status === 'PASS' || verificationResult.status === 'SKIPPED'

  // An ESLint ERROR is an infrastructure/config failure, not a defect in the
  // agent's code. It must not consume a correction attempt: the attempt stays
  // IN_PROGRESS (not counted toward the budget) so the agent can fix the tooling
  // problem and re-run without ever reaching BUDGET_EXCEEDED.
  const isInfraError = verificationResult.status === 'ERROR'

  // Record the verification result on the attempt. On a real PASS/FAIL the attempt
  // is completed; on an infra ERROR it remains IN_PROGRESS so budget is untouched.
  const verifiedAttempt: Attempt = {
    ...attempt,
    completedAt: isInfraError ? attempt.completedAt : new Date().toISOString(),
    status: isInfraError ? 'IN_PROGRESS' : 'COMPLETED',
    verificationResult,
  }

  const sessionAfterVerify: Session = {
    ...toVerifying.session,
    attempts: toVerifying.session.attempts.map(a =>
      a.id === verifiedAttempt.id ? verifiedAttempt : a
    ),
  }

  let nextStatus: 'DONE' | 'CORRECTING' | 'BUDGET_EXCEEDED'
  if (passed) {
    nextStatus = 'DONE'
  } else if (isInfraError || canAttemptCorrection(sessionAfterVerify)) {
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
      // Include raw output when ESLint errored so the trace/summary is actionable.
      ...(verificationResult.status === 'ERROR'
        ? { verificationError: verificationResult.rawOutput }
        : {}),
      message:
        'Correction budget exhausted. Stop and inform the developer. ' +
        'The full attempt history is in the trace file for manual review.',
    }
  }

  return {
    sessionId: session.id,
    status: 'CORRECTING',
    attemptNumber: verifiedAttempt.attemptNumber,
    // On an infra error the attempt was not consumed, so the full budget remains.
    remainingAttempts: isInfraError
      ? finalSession.correctionBudget - finalSession.attempts.length + 1
      : finalSession.correctionBudget - finalSession.attempts.length,
    failureEvidence: verificationResult.failureEvidence,
    // On ERROR, ESLint threw before producing structured evidence. Surface the raw
    // output so the agent has something concrete to correct against.
    ...(isInfraError ? { verificationError: verificationResult.rawOutput } : {}),
    message: isInfraError
      ? 'Lint could not run (ESLint error) — this attempt was not counted against ' +
        'your correction budget. See verificationError for details, fix the underlying ' +
        'problem, then call submit_correction and apply_changes.'
      : 'Lint failed. Analyze the failure evidence above and call submit_correction ' +
        'with the corrected file content, then call apply_changes.',
  }
}

export const runLintToolDefinition = {
  name: 'coding_run_lint',
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
