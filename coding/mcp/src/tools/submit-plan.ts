import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { Plan } from '../domain/types.js'

export async function handleSubmitPlan(
  args: { sessionId: string; reasoning: string; filesConsidered: string[] },
  ctx: AppContext
) {
  const session = await ctx.store.load(args.sessionId)

  if (session.status !== 'READING') {
    throw new Error(`submit_plan requires status READING, got ${session.status}`)
  }

  if (!args.reasoning || args.reasoning.trim().length === 0) {
    throw new Error('reasoning is required and must not be empty')
  }

  const plan: Plan = {
    id: randomUUID(),
    sessionId: session.id,
    createdAt: new Date().toISOString(),
    reasoning: args.reasoning.trim(),
    filesConsidered: args.filesConsidered ?? [],
  }

  const transResult = transition(session, 'PLANNING')
  if (!transResult.ok) throw new Error(transResult.error)

  const updatedSession = { ...transResult.session, plan }
  await ctx.store.save(updatedSession, session)

  return {
    sessionId: session.id,
    status: 'PLANNING',
    planId: plan.id,
    message:
      'Plan recorded. Call submit_proposed_change for each file you want to create or modify.',
  }
}

export const submitPlanToolDefinition = {
  name: 'coding_submit_plan',
  description:
    'Record the implementation plan after reading the scope. ' +
    'Explain your reasoning and list files considered. Transitions session to PLANNING.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID' },
      reasoning: {
        type: 'string',
        description:
          'Detailed explanation of what you plan to implement and why. ' +
          'This is stored in the traceability graph.',
      },
      filesConsidered: {
        type: 'array',
        items: { type: 'string' },
        description: 'Absolute paths of files you read or considered for this plan',
      },
    },
    required: ['sessionId', 'reasoning', 'filesConsidered'],
  },
}
