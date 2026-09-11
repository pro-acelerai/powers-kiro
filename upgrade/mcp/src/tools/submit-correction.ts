import { randomUUID } from 'node:crypto'
import type { AppContext } from '../context.js'
import type { ExecutionSession } from '../domain/types.js'
import { canAttemptCorrection, currentAttemptNumber } from '../domain/state-machine.js'

export async function handleSubmitCorrection(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'execution') {
    throw new Error(`upgrade_submit_correction requires an execution session, got ${session.type}`)
  }

  if (session.status !== 'CORRECTING') {
    throw new Error(`upgrade_submit_correction requires status CORRECTING, got ${session.status}`)
  }

  const exec = session as ExecutionSession

  if (exec.attempts.some(a => a.status === 'IN_PROGRESS')) {
    throw new Error('There is already an IN_PROGRESS attempt. Submit file changes and apply before calling upgrade_submit_correction again.')
  }

  if (!canAttemptCorrection(exec)) {
    throw new Error(
      `Correction budget exhausted. Used ${exec.attempts.length} of ${exec.correctionBudget} attempts.`
    )
  }

  const newAttemptNumber = currentAttemptNumber(exec)

  const newAttempt = {
    id: randomUUID(),
    sessionId: args.sessionId,
    attemptNumber: newAttemptNumber,
    createdAt: new Date().toISOString(),
    completedAt: null,
    status: 'IN_PROGRESS' as const,
    fileChanges: [],
    validationResult: null,
  }

  const updated = { ...exec, attempts: [...exec.attempts, newAttempt] } as ExecutionSession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'CORRECTING',
    nextAttemptNumber: newAttemptNumber,
    attemptsRemaining: exec.correctionBudget - exec.attempts.length - 1,
    message:
      `Correction authorized. Attempt #${newAttemptNumber} started. ` +
      `Submit corrected files via upgrade_submit_file_change, then upgrade_apply_changes and upgrade_run_validation.`,
  }
}

export const submitCorrectionToolDefinition = {
  name: 'upgrade_submit_correction',
  description:
    'Authorize a new correction attempt after validation failure. ' +
    'After calling this, use upgrade_submit_file_change to provide corrected file contents, ' +
    'then upgrade_apply_changes and upgrade_run_validation again. ' +
    'Harness enforces the correction budget (max 3 total attempts).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The execution session ID' },
    },
    required: ['sessionId'],
  },
}
