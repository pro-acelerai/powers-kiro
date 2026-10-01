import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { AnalysisSession, HumanDecision } from '../domain/types.js'

interface RequestPlanApprovalArgs {
  sessionId: string
  approved: boolean
  notes: string
}

export async function handleRequestPlanApproval(args: RequestPlanApprovalArgs, ctx: AppContext) {
  const { sessionId, approved, notes } = args

  if (typeof approved !== 'boolean') throw new Error('approved must be a boolean')
  if (!notes?.trim()) throw new Error('notes is required')

  const session = await ctx.store.load(sessionId)

  if (session.type !== 'analysis') {
    throw new Error(`upgrade_request_plan_approval requires an analysis session, got ${session.type}`)
  }

  if (session.status !== 'PLAN_REVIEW') {
    throw new Error(`upgrade_request_plan_approval requires status PLAN_REVIEW, got ${session.status}`)
  }

  const analysis = session as AnalysisSession

  const humanDecision: HumanDecision = {
    id: randomUUID(),
    sessionId,
    decidedAt: new Date().toISOString(),
    approved,
    notes: notes.trim(),
  }

  if (approved) {
    const transResult = transition(session, 'DONE')
    if (!transResult.ok) throw new Error(transResult.error)

    const resolution = {
      id: randomUUID(),
      sessionId,
      resolvedAt: new Date().toISOString(),
      outcome: 'DONE' as const,
    }

    const updated = { ...transResult.session, humanDecision, resolution } as AnalysisSession
    await ctx.store.save(updated, session)

    return {
      sessionId,
      status: 'DONE',
      approved: true,
      notes: notes.trim(),
      message: 'Upgrade plan approved. Analysis session is DONE. Create an execution session to apply the changes.',
    }
  }

  // Rejected
  const newRefinementCount = analysis.refinementCount + 1

  if (newRefinementCount > analysis.refinementBudget) {
    const transResult = transition(session, 'REJECTED')
    if (!transResult.ok) throw new Error(transResult.error)

    const resolution = {
      id: randomUUID(),
      sessionId,
      resolvedAt: new Date().toISOString(),
      outcome: 'REJECTED' as const,
    }

    const updated = { ...transResult.session, humanDecision, resolution, refinementCount: newRefinementCount } as AnalysisSession
    await ctx.store.save(updated, session)

    return {
      sessionId,
      status: 'REJECTED',
      approved: false,
      notes: notes.trim(),
      refinementCount: newRefinementCount,
      refinementBudget: analysis.refinementBudget,
      message: 'Upgrade plan rejected. Refinement budget exhausted. Session is REJECTED.',
    }
  }

  // Return to SCANNING for refinement
  const transResult = transition(session, 'SCANNING')
  if (!transResult.ok) throw new Error(transResult.error)

  const updated = { ...transResult.session, humanDecision, refinementCount: newRefinementCount } as AnalysisSession
  await ctx.store.save(updated, session)

  return {
    sessionId,
    status: 'SCANNING',
    approved: false,
    notes: notes.trim(),
    refinementCount: newRefinementCount,
    refinementBudget: analysis.refinementBudget,
    attemptsRemaining: analysis.refinementBudget - newRefinementCount,
    message: `Plan rejected. Session returned to SCANNING for refinement (${analysis.refinementBudget - newRefinementCount} attempt(s) remaining). Review the notes and submit a revised plan.`,
  }
}

export const requestPlanApprovalToolDefinition = {
  name: 'upgrade_request_plan_approval',
  description:
    'Record the human decision on the upgrade plan. ' +
    'approved=true transitions to DONE (plan accepted, ready to execute). ' +
    'approved=false returns to SCANNING for refinement (up to 2 refinements allowed), ' +
    'or transitions to REJECTED if the refinement budget is exhausted.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The analysis session ID' },
      approved: { type: 'boolean', description: 'Whether the plan was approved' },
      notes: { type: 'string', description: 'Human review notes — rationale for approval or rejection feedback' },
    },
    required: ['sessionId', 'approved', 'notes'],
  },
}
