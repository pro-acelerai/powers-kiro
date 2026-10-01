import { randomUUID } from 'node:crypto'
import type { AppContext } from '../context.js'
import type { ThinkRecord } from '../domain/types.js'

const TERMINAL_STATUSES = new Set(['DONE', 'REJECTED', 'FAILED', 'BUDGET_EXCEEDED'])

export async function handleSubmitThink(
  args: { sessionId: string; phase: string; reasoning: string },
  ctx: AppContext
) {
  const { sessionId, phase, reasoning } = args

  if (!phase?.trim()) throw new Error('phase is required')
  if (!reasoning?.trim()) throw new Error('reasoning is required')

  const session = await ctx.store.load(sessionId)

  if (TERMINAL_STATUSES.has(session.status)) {
    throw new Error(`Cannot record think in terminal state: ${session.status}`)
  }

  const record: ThinkRecord = {
    id: randomUUID(),
    sessionId,
    createdAt: new Date().toISOString(),
    phase: phase.trim(),
    reasoning: reasoning.trim(),
  }

  const updated = { ...session, thinkRecords: [...session.thinkRecords, record] }
  await ctx.store.save(updated, session)

  return {
    sessionId,
    thinkId: record.id,
    phase: record.phase,
    status: session.status,
    totalThinkRecords: updated.thinkRecords.length,
    message: 'Think record saved. Continue analysis.',
  }
}

export const submitThinkToolDefinition = {
  name: 'upgrade_submit_think',
  description:
    'Record an intermediate reasoning step during any upgrade phase. ' +
    'Does not change session state — just persists the reasoning for auditability. ' +
    'Use before major submissions (issues, plan, file changes) to document your reasoning chain.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID' },
      phase: {
        type: 'string',
        description: 'Label for this think step (e.g. "dependency analysis", "api compatibility check", "plan validation")',
      },
      reasoning: {
        type: 'string',
        description: 'Full reasoning text — what you observed, what you concluded, and why',
      },
    },
    required: ['sessionId', 'phase', 'reasoning'],
  },
}
