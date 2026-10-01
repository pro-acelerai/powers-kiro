import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { AnalysisSession, UpgradePlan, PlannedChange, RiskLevel } from '../domain/types.js'

interface SubmitPlanChange {
  file: string
  description: string
  issueRefs: string[]
  riskLevel: RiskLevel
}

interface SubmitPlanArgs {
  sessionId: string
  upgradeTarget: string
  reasoning: string
  changes: SubmitPlanChange[]
  rawMarkdown: string
}

export async function handleSubmitPlan(args: SubmitPlanArgs, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'analysis') {
    throw new Error(`upgrade_submit_plan requires an analysis session, got ${session.type}`)
  }

  if (session.status !== 'SCANNING') {
    throw new Error(`upgrade_submit_plan requires status SCANNING, got ${session.status}`)
  }

  if (!args.upgradeTarget?.trim()) throw new Error('upgradeTarget is required')
  if (!args.reasoning?.trim()) throw new Error('reasoning is required')
  if (!Array.isArray(args.changes)) throw new Error('changes must be an array')
  if (!args.rawMarkdown?.trim()) throw new Error('rawMarkdown is required')

  const analysis = session as AnalysisSession

  const changes: PlannedChange[] = args.changes.map(c => ({
    id: randomUUID(),
    file: c.file,
    description: c.description,
    issueRefs: c.issueRefs ?? [],
    riskLevel: c.riskLevel,
  }))

  const plan: UpgradePlan = {
    id: randomUUID(),
    sessionId: args.sessionId,
    createdAt: new Date().toISOString(),
    version: (analysis.plan?.version ?? 0) + 1,
    upgradeTarget: args.upgradeTarget.trim(),
    reasoning: args.reasoning.trim(),
    changes,
    rawMarkdown: args.rawMarkdown.trim(),
  }

  const transResult = transition(session, 'PLAN_REVIEW')
  if (!transResult.ok) throw new Error(transResult.error)

  const updated = { ...transResult.session, plan } as AnalysisSession
  await ctx.store.save(updated, session)

  return {
    sessionId: args.sessionId,
    planId: plan.id,
    planVersion: plan.version,
    upgradeTarget: plan.upgradeTarget,
    totalChanges: changes.length,
    status: 'PLAN_REVIEW',
    message: 'Upgrade plan submitted. Call upgrade_request_plan_approval to request human review.',
  }
}

export const submitPlanToolDefinition = {
  name: 'upgrade_submit_plan',
  description:
    'Submit the upgrade plan for human review. ' +
    'Lists all planned file changes with their risk level and issue references. ' +
    'Transitions the analysis session from SCANNING to PLAN_REVIEW. ' +
    'If the plan is rejected, the session returns to SCANNING for refinement.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The analysis session ID' },
      upgradeTarget: { type: 'string', description: 'Target version or platform (e.g. "Node.js 20 LTS")' },
      reasoning: {
        type: 'string',
        description: 'Explanation of the upgrade strategy and why these changes are needed',
      },
      changes: {
        type: 'array',
        description: 'Planned file changes',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File path to change (absolute or relative to projectPath)' },
            description: { type: 'string', description: 'What change will be made to this file' },
            issueRefs: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of issues this change addresses',
            },
            riskLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Risk level of this change',
            },
          },
          required: ['file', 'description', 'issueRefs', 'riskLevel'],
        },
      },
      rawMarkdown: {
        type: 'string',
        description: 'Full markdown description of the upgrade plan for human review',
      },
    },
    required: ['sessionId', 'upgradeTarget', 'reasoning', 'changes', 'rawMarkdown'],
  },
}
