import { randomUUID } from 'node:crypto'
import type { AppContext } from '../context.js'
import type { ImplementationSession } from '../domain/types.js'
import { canAttemptCorrection, currentAttemptNumber } from '../domain/state-machine.js'

export async function handleSubmitCorrection(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'implementation') {
    throw new Error(`submit_correction requires an implementation session, got ${session.type}`)
  }

  if (session.status !== 'CORRECTING') {
    throw new Error(`submit_correction requires status CORRECTING, got ${session.status}`)
  }

  const impl = session as ImplementationSession

  if (impl.attempts.some(a => a.status === 'IN_PROGRESS')) {
    throw new Error('There is already an IN_PROGRESS attempt. Submit files and apply before calling submit_correction again.')
  }

  if (!canAttemptCorrection(impl)) {
    throw new Error(
      `Correction budget exhausted. Used ${impl.attempts.length} of ${impl.correctionBudget} attempts.`
    )
  }

  const newAttemptNumber = currentAttemptNumber(impl)

  const newAttempt = {
    id: randomUUID(),
    sessionId: args.sessionId,
    attemptNumber: newAttemptNumber,
    createdAt: new Date().toISOString(),
    completedAt: null,
    status: 'IN_PROGRESS' as const,
    newFiles: [],
    verificationResult: null,
  }

  const updated = { ...impl, attempts: [...impl.attempts, newAttempt] } as ImplementationSession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'CORRECTING',
    nextAttemptNumber: newAttemptNumber,
    attemptsRemaining: impl.correctionBudget - impl.attempts.length - 1,
    message:
      `Correction authorized. Attempt #${newAttemptNumber} started. ` +
      `Submit corrected files via submit_new_file, then apply_new_project and run_lint.`,
  }
}

export const submitCorrectionToolDefinition = {
  name: 'modernization_submit_correction',
  description:
    'Authorize a new correction attempt after lint failure. ' +
    'After calling this, use submit_new_file to provide corrected file contents, ' +
    'then apply_new_project and run_lint again. ' +
    'Harness enforces the correction budget (max 3 total attempts).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The implementation session ID' },
    },
    required: ['sessionId'],
  },
}
