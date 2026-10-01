import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { DiscoverySession, HumanDecision, Resolution } from '../domain/types.js'

export async function handleRequestSpecApproval(
  args: { sessionId: string; approved: boolean; notes: string },
  ctx: AppContext
) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'discovery') {
    throw new Error(`request_spec_approval requires a discovery session, got ${session.type}`)
  }

  if (session.status !== 'SPEC_REVIEW') {
    throw new Error(`request_spec_approval requires status SPEC_REVIEW, got ${session.status}`)
  }

  const discovery = session as DiscoverySession
  const now = new Date().toISOString()

  const humanDecision: HumanDecision = {
    id: randomUUID(),
    sessionId: args.sessionId,
    decidedAt: now,
    approved: args.approved,
    notes: args.notes ?? '',
  }

  if (args.approved) {
    const transResult = transition(session, 'DONE')
    if (!transResult.ok) throw new Error(transResult.error)

    const resolution: Resolution = {
      id: randomUUID(),
      sessionId: args.sessionId,
      resolvedAt: now,
      outcome: 'DONE',
    }

    const updated = { ...transResult.session, humanDecision, resolution } as DiscoverySession
    await ctx.store.save(updated, session)

    return {
      sessionId: session.id,
      status: 'DONE',
      approved: true,
      message: 'Specification approved. Discovery phase complete. Create an architecture session next.',
    }
  }

  // Rejected — check refinement budget
  if (discovery.refinementCount >= discovery.refinementBudget) {
    const transResult = transition(session, 'REJECTED')
    if (!transResult.ok) throw new Error(transResult.error)

    const resolution: Resolution = {
      id: randomUUID(),
      sessionId: args.sessionId,
      resolvedAt: now,
      outcome: 'REJECTED',
    }

    const updated = { ...transResult.session, humanDecision, resolution } as DiscoverySession
    await ctx.store.save(updated, session)

    return {
      sessionId: session.id,
      status: 'REJECTED',
      approved: false,
      refinementsUsed: discovery.refinementCount,
      refinementBudget: discovery.refinementBudget,
      message: 'Spec rejected and refinement budget exhausted. Session failed. Start a new discovery session.',
    }
  }

  // Can refine — go back to SPECIFYING
  const transResult = transition(session, 'SPECIFYING')
  if (!transResult.ok) throw new Error(transResult.error)

  const updated = {
    ...transResult.session,
    humanDecision,
    refinementCount: discovery.refinementCount + 1,
  } as DiscoverySession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'SPECIFYING',
    approved: false,
    refinementsRemaining: discovery.refinementBudget - (discovery.refinementCount + 1),
    rejectionNotes: args.notes,
    message: `Spec rejected. ${discovery.refinementBudget - (discovery.refinementCount + 1)} refinement(s) remaining. ` +
      `Address the feedback, then call submit_specification again.`,
  }
}

export const requestSpecApprovalToolDefinition = {
  name: 'modernization_request_spec_approval',
  description:
    'Submit the human approval decision for the extracted specification. ' +
    'If approved: session transitions to DONE — discovery phase complete. ' +
    'If rejected: returns to SPECIFYING for refinement (up to 2 times). ' +
    'The agent must present the spec to the user and WAIT for their response before calling this tool.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The discovery session ID' },
      approved: { type: 'boolean', description: 'Whether the human approved the specification' },
      notes: { type: 'string', description: 'Human feedback or approval notes' },
    },
    required: ['sessionId', 'approved', 'notes'],
  },
}
