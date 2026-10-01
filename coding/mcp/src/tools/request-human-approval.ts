import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { HumanDecision } from '../domain/types.js'

export async function handleRequestHumanApproval(
  args: { sessionId: string; approved: boolean; notes?: string },
  ctx: AppContext
) {
  const session = await ctx.store.load(args.sessionId)

  if (session.status !== 'PROPOSED') {
    throw new Error(
      `request_human_approval requires status PROPOSED, got ${session.status}. ` +
        `Call submit_proposed_change first.`
    )
  }

  const decision: HumanDecision = {
    id: randomUUID(),
    sessionId: session.id,
    decidedAt: new Date().toISOString(),
    approved: args.approved,
    notes: args.notes ?? '',
  }

  const nextStatus = args.approved ? ('APPROVED' as const) : ('REJECTED' as const)
  const transResult = transition(session, nextStatus)
  if (!transResult.ok) throw new Error(transResult.error)

  const updatedSession = { ...transResult.session, humanDecision: decision }
  await ctx.store.save(updatedSession, session)

  if (!args.approved) {
    return {
      sessionId: session.id,
      status: 'REJECTED',
      message:
        'Human rejected the proposed changes. Session is closed. ' +
        'Start a new session if you want to try a different approach.',
    }
  }

  const attempt = updatedSession.attempts.find(a => a.status === 'IN_PROGRESS')
  const changeCount = attempt?.proposedChanges.length ?? 0

  return {
    sessionId: session.id,
    status: 'APPROVED',
    changeCount,
    message: `Human approved ${changeCount} change(s). Call apply_changes to write files to disk.`,
  }
}

export const requestHumanApprovalToolDefinition = {
  name: 'coding_request_human_approval',
  description:
    "Record the human's decision on the proposed changes. " +
    'Present the list of proposed changes to the human first, ' +
    'then call this tool with their explicit answer (approved: true or false).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID' },
      approved: {
        type: 'boolean',
        description:
          'true if the human explicitly approved the changes, false if they rejected them',
      },
      notes: {
        type: 'string',
        description: 'Optional notes or feedback from the human',
      },
    },
    required: ['sessionId', 'approved'],
  },
}
