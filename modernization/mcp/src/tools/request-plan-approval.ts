import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { ArchitectureSession, HumanDecision, Resolution } from '../domain/types.js'

export async function handleRequestPlanApproval(
  args: { sessionId: string; approved: boolean; notes: string },
  ctx: AppContext
) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'architecture') {
    throw new Error(`request_plan_approval requires an architecture session, got ${session.type}`)
  }

  if (session.status !== 'PLAN_REVIEW') {
    throw new Error(`request_plan_approval requires status PLAN_REVIEW, got ${session.status}`)
  }

  const arch = session as ArchitectureSession
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

    const updated = { ...transResult.session, humanDecision, resolution } as ArchitectureSession
    await ctx.store.save(updated, session)

    const plan = arch.migrationPlan
    if (!plan) throw new Error('Architecture session has no migration plan. Call submit_migration_plan before approving.')

    return {
      sessionId: session.id,
      status: 'DONE',
      approved: true,
      planId: plan.id,
      newProjectPath: plan.newProjectPath,
      phasesCount: plan.phases.length,
      phases: plan.phases.map(p => ({
        id: p.id,
        number: p.number,
        title: p.title,
        estimatedComplexity: p.estimatedComplexity,
      })),
      message:
        'Migration plan approved. Architecture phase complete. ' +
        `Create ${plan.phases.length} implementation session(s) — one per phase — using create_session with type "implementation".`,
    }
  }

  // Rejected — check refinement budget
  if (arch.refinementCount >= arch.refinementBudget) {
    const transResult = transition(session, 'REJECTED')
    if (!transResult.ok) throw new Error(transResult.error)

    const resolution: Resolution = {
      id: randomUUID(),
      sessionId: args.sessionId,
      resolvedAt: now,
      outcome: 'REJECTED',
    }

    const updated = { ...transResult.session, humanDecision, resolution } as ArchitectureSession
    await ctx.store.save(updated, session)

    return {
      sessionId: session.id,
      status: 'REJECTED',
      approved: false,
      message: 'Plan rejected and refinement budget exhausted. Start a new architecture session.',
    }
  }

  // Can refine
  const transResult = transition(session, 'PLANNING')
  if (!transResult.ok) throw new Error(transResult.error)

  const updated = {
    ...transResult.session,
    humanDecision,
    refinementCount: arch.refinementCount + 1,
  } as ArchitectureSession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'PLANNING',
    approved: false,
    refinementsRemaining: arch.refinementBudget - (arch.refinementCount + 1),
    rejectionNotes: args.notes,
    message:
      `Plan rejected. ${arch.refinementBudget - (arch.refinementCount + 1)} refinement(s) remaining. ` +
      `Address the feedback and call submit_migration_plan again.`,
  }
}

export const requestPlanApprovalToolDefinition = {
  name: 'modernization_request_plan_approval',
  description:
    'Submit the human approval decision for the migration plan. ' +
    'If approved: session transitions to DONE — architecture phase complete, phases ready for implementation. ' +
    'If rejected: returns to PLANNING for refinement (up to 2 times). ' +
    'The agent must present the plan to the user and WAIT for their response before calling this tool.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The architecture session ID' },
      approved: { type: 'boolean', description: 'Whether the human approved the migration plan' },
      notes: { type: 'string', description: 'Human feedback or approval notes' },
    },
    required: ['sessionId', 'approved', 'notes'],
  },
}
