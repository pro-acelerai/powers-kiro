import { randomUUID } from 'node:crypto'
import { resolve, isAbsolute, sep } from 'node:path'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { ArchitectureSession, MigrationPlan, MigrationPhase } from '../domain/types.js'

interface SubmitPlanArgs {
  sessionId: string
  targetStack: string
  newProjectName: string
  architectureDecisions: string[]
  phases: Omit<MigrationPhase, 'id'>[]
  rawMarkdown: string
}

export async function handleSubmitMigrationPlan(args: SubmitPlanArgs, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'architecture') {
    throw new Error(`submit_migration_plan requires an architecture session, got ${session.type}`)
  }

  if (session.status !== 'PLANNING') {
    throw new Error(`submit_migration_plan requires status PLANNING, got ${session.status}`)
  }

  if (!args.targetStack?.trim()) throw new Error('targetStack is required')
  if (!args.newProjectName?.trim()) throw new Error('newProjectName is required')
  if (isAbsolute(args.newProjectName.trim())) {
    throw new Error('newProjectName must be a relative directory name (e.g. "my-app-modern"), not an absolute path')
  }
  if (!Array.isArray(args.phases) || args.phases.length === 0) throw new Error('phases must be a non-empty array')
  if (!args.rawMarkdown?.trim()) throw new Error('rawMarkdown is required')

  const arch = session as ArchitectureSession
  const version = (arch.migrationPlan?.version ?? 0) + 1

  const phases: MigrationPhase[] = args.phases.map((p, i) => ({
    id: randomUUID(),
    number: p.number ?? i + 1,
    title: p.title,
    description: p.description,
    targetModule: p.targetModule,
    dependencies: p.dependencies ?? [],
    estimatedComplexity: p.estimatedComplexity ?? 'medium',
  }))

  const newProjectPath = resolve(ctx.workspacePath, args.newProjectName.trim())
  if (!newProjectPath.startsWith(ctx.workspacePath + sep)) {
    throw new Error(
      `newProjectName "${args.newProjectName.trim()}" resolves outside the workspace. ` +
      `Use a simple directory name like "my-app-modern".`
    )
  }

  const plan: MigrationPlan = {
    id: randomUUID(),
    sessionId: args.sessionId,
    createdAt: new Date().toISOString(),
    version,
    targetStack: args.targetStack.trim(),
    newProjectName: args.newProjectName.trim(),
    newProjectPath,
    architectureDecisions: args.architectureDecisions ?? [],
    phases,
    rawMarkdown: args.rawMarkdown.trim(),
  }

  const transResult = transition(session, 'PLAN_REVIEW')
  if (!transResult.ok) throw new Error(transResult.error)

  const updated = { ...transResult.session, migrationPlan: plan } as ArchitectureSession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'PLAN_REVIEW',
    planId: plan.id,
    version: plan.version,
    newProjectPath: plan.newProjectPath,
    phasesCount: plan.phases.length,
    phases: plan.phases.map(p => ({
      id: p.id,
      number: p.number,
      title: p.title,
      estimatedComplexity: p.estimatedComplexity,
      dependencies: p.dependencies,
    })),
    planMarkdown: plan.rawMarkdown,
    message:
      'Migration plan submitted. Present the plan to the user for review. ' +
      'Wait for their response then call request_plan_approval.',
  }
}

export const submitMigrationPlanToolDefinition = {
  name: 'modernization_submit_migration_plan',
  description:
    'Submit the migration plan for the new system. ' +
    'The plan must define: target stack, new project name/path, key architecture decisions, ' +
    'and a list of phases (each phase becomes an implementation session). ' +
    'Transitions to PLAN_REVIEW for human approval.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The architecture session ID' },
      targetStack: { type: 'string', description: 'Target technology stack (e.g. "Node.js + TypeScript + Fastify + Prisma + PostgreSQL")' },
      newProjectName: { type: 'string', description: 'Directory name for the new project (e.g. "my-app-modern")' },
      architectureDecisions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key architecture decisions with reasoning (one decision per item)',
      },
      phases: {
        type: 'array',
        description: 'Ordered list of implementation phases',
        items: {
          type: 'object',
          properties: {
            number: { type: 'number', description: 'Phase number (1, 2, 3...)' },
            title: { type: 'string', description: 'Short title for this phase' },
            description: { type: 'string', description: 'What this phase builds' },
            targetModule: { type: 'string', description: 'Main module or layer being built (e.g. "domain", "api", "auth")' },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Phase numbers or titles this phase depends on',
            },
            estimatedComplexity: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
          },
          required: ['title', 'description', 'targetModule'],
        },
      },
      rawMarkdown: {
        type: 'string',
        description: 'Human-readable Markdown version of the full migration plan',
      },
    },
    required: ['sessionId', 'targetStack', 'newProjectName', 'phases', 'rawMarkdown'],
  },
}
