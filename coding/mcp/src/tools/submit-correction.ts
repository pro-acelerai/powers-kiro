import { randomUUID } from 'node:crypto'
import { assertInScope } from '../harness/scope.js'
import { canAttemptCorrection } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { Attempt, ProposedChange, Session } from '../domain/types.js'

export async function handleSubmitCorrection(
  args: {
    sessionId: string
    file: string
    operation: 'create' | 'modify' | 'delete'
    content: string
    justification: string
  },
  ctx: AppContext
) {
  const session = await ctx.store.load(args.sessionId)

  if (session.status !== 'CORRECTING') {
    throw new Error(
      `submit_correction requires status CORRECTING, got ${session.status}. ` +
        `Call run_lint first to get the failure evidence.`
    )
  }

  assertInScope(args.file, session.scope)

  const change: ProposedChange = {
    id: randomUUID(),
    attemptId: '',
    file: args.file,
    operation: args.operation,
    content: args.operation === 'delete' ? '' : (args.content ?? ''),
    justification: args.justification,
    originalContent: null,
  }

  let updatedSession: Session

  const existingInProgress = session.attempts.find(a => a.status === 'IN_PROGRESS')

  if (existingInProgress) {
    // Accumulate in the new attempt already created by a previous submit_correction call
    change.attemptId = existingInProgress.id
    const updatedAttempt: Attempt = {
      ...existingInProgress,
      proposedChanges: [...existingInProgress.proposedChanges, change],
    }
    updatedSession = {
      ...session,
      attempts: session.attempts.map(a =>
        a.id === existingInProgress.id ? updatedAttempt : a
      ),
    }
  } else {
    // First submit_correction call: create a new attempt (budget guard)
    if (!canAttemptCorrection(session)) {
      throw new Error(
        `Correction budget exhausted: ${session.correctionBudget} attempts already used. ` +
        `Session cannot be corrected further.`
      )
    }
    const attemptId = randomUUID()
    change.attemptId = attemptId

    const newAttempt: Attempt = {
      id: attemptId,
      sessionId: session.id,
      attemptNumber: session.attempts.length + 1,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'IN_PROGRESS',
      proposedChanges: [change],
      verificationResult: null,
    }

    updatedSession = { ...session, attempts: [...session.attempts, newAttempt] }
  }

  await ctx.store.save(updatedSession, session)

  const currentAttempt = updatedSession.attempts.find(a => a.status === 'IN_PROGRESS')!

  return {
    sessionId: session.id,
    status: 'CORRECTING',
    attemptNumber: currentAttempt.attemptNumber,
    changeId: change.id,
    totalChanges: currentAttempt.proposedChanges.length,
    message:
      'Correction recorded. Call submit_correction again for more files, ' +
      'or call apply_changes to apply and re-verify.',
  }
}

export const submitCorrectionToolDefinition = {
  name: 'coding_submit_correction',
  description:
    'Submit corrected file content after a lint failure. ' +
    'Creates a new attempt. Call multiple times for multiple files. ' +
    'Then call apply_changes to write and re-verify.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID' },
      file: {
        type: 'string',
        description: 'Absolute path to the file to correct (must be within scope)',
      },
      operation: {
        type: 'string',
        enum: ['create', 'modify', 'delete'],
        description: 'Type of change',
      },
      content: {
        type: 'string',
        description: 'Full corrected content for the file',
      },
      justification: {
        type: 'string',
        description: 'What was wrong and what you fixed, referencing the failure evidence',
      },
    },
    required: ['sessionId', 'file', 'operation', 'content', 'justification'],
  },
}
