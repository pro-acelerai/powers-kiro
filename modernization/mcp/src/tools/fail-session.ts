import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { Resolution, Session } from '../domain/types.js'

const TERMINAL_STATUSES = new Set(['DONE', 'REJECTED', 'FAILED', 'BUDGET_EXCEEDED'])

export async function handleFailSession(
  args: { sessionId: string; reason: string },
  ctx: AppContext
) {
  const { sessionId, reason } = args

  if (!reason?.trim()) throw new Error('reason is required')

  const session = await ctx.store.load(sessionId)

  if (TERMINAL_STATUSES.has(session.status)) {
    throw new Error(
      `Session is already in terminal state: ${session.status}. Cannot transition to FAILED.`
    )
  }

  const transResult = transition(session, 'FAILED')
  if (!transResult.ok) throw new Error(transResult.error)

  const resolution: Resolution = {
    id: randomUUID(),
    sessionId,
    resolvedAt: new Date().toISOString(),
    outcome: 'FAILED',
  }

  const updated = { ...transResult.session, resolution } as Session
  await ctx.store.save(updated, session)

  return {
    sessionId,
    type: session.type,
    previousStatus: session.status,
    status: 'FAILED',
    reason: reason.trim(),
    message: `Session marked as FAILED from ${session.status}. Reason: ${reason.trim()}`,
  }
}

export const failSessionToolDefinition = {
  name: 'modernization_fail_session',
  description:
    'Mark a session as permanently FAILED from any non-terminal state. ' +
    'Use when an unrecoverable error makes it impossible to continue the session. ' +
    'Records the reason in the session resolution. ' +
    'Cannot be called on sessions already in DONE, REJECTED, FAILED, or BUDGET_EXCEEDED.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID to mark as failed' },
      reason: { type: 'string', description: 'Clear description of why the session cannot continue' },
    },
    required: ['sessionId', 'reason'],
  },
}
