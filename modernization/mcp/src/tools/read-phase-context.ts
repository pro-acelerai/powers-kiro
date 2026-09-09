import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { ImplementationSession, DiscoverySession, ArchitectureSession } from '../domain/types.js'

export async function handleReadPhaseContext(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'implementation') {
    throw new Error(`read_phase_context requires an implementation session, got ${session.type}`)
  }

  if (session.status !== 'CREATED') {
    throw new Error(`read_phase_context requires status CREATED, got ${session.status}`)
  }

  const impl = session as ImplementationSession

  const discoverySession = await ctx.store.load(impl.discoverySessionId)
  if (discoverySession.type !== 'discovery' || discoverySession.status !== 'DONE') {
    throw new Error('Discovery session is not available or not DONE')
  }

  const architectureSession = await ctx.store.load(impl.architectureSessionId)
  if (architectureSession.type !== 'architecture' || architectureSession.status !== 'DONE') {
    throw new Error('Architecture session is not available or not DONE')
  }

  const discovery = discoverySession as DiscoverySession
  const architecture = architectureSession as ArchitectureSession
  const plan = architecture.migrationPlan
  const spec = discovery.specification
  if (!plan) throw new Error(`Architecture session ${impl.architectureSessionId} has no migration plan`)
  if (!spec) throw new Error(`Discovery session ${impl.discoverySessionId} has no specification`)

  const currentPhase = plan.phases.find(p => p.id === impl.phaseId)
  if (!currentPhase) {
    throw new Error(`Phase ${impl.phaseId} not found in migration plan`)
  }

  const transResult = transition(session, 'BUILDING')
  if (!transResult.ok) throw new Error(transResult.error)
  await ctx.store.save(transResult.session, session)

  return {
    sessionId: session.id,
    status: 'BUILDING',
    phase: {
      id: currentPhase.id,
      number: currentPhase.number,
      title: currentPhase.title,
      description: currentPhase.description,
      targetModule: currentPhase.targetModule,
      estimatedComplexity: currentPhase.estimatedComplexity,
    },
    newProjectPath: impl.newProjectPath,
    correctionBudget: impl.correctionBudget,
    migrationPlan: {
      targetStack: plan.targetStack,
      newProjectName: plan.newProjectName,
      architectureDecisions: plan.architectureDecisions,
      allPhases: plan.phases.map(p => ({ id: p.id, number: p.number, title: p.title })),
    },
    specification: {
      domainEntities: spec.domainEntities,
      businessRules: spec.businessRules,
      flows: spec.flows,
      externalContracts: spec.externalContracts,
      databaseRules: spec.databaseRules ?? [],
      excludedScope: spec.excludedScope ?? [],
      nonFunctional: spec.nonFunctional,
    },
    migrateAndFixFindings: discovery.findings
      .filter(f => f.classification === 'MIGRATE_AND_FIX')
      .map(f => ({ title: f.title, description: f.description, recommendation: f.recommendation, file: f.file })),
    message:
      `Phase context loaded. Build Phase ${currentPhase.number}: ${currentPhase.title}. ` +
      `Use submit_think to plan, then submit_new_file for each file, ` +
      `then apply_new_project to write them.`,
  }
}

export const readPhaseContextToolDefinition = {
  name: 'modernization_read_phase_context',
  description:
    'Load the full context for the current implementation phase: ' +
    'spec from discovery, migration plan from architecture, and current phase details. ' +
    'Transitions the implementation session from CREATED to BUILDING. ' +
    'Must be called before submitting new files.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The implementation session ID' },
    },
    required: ['sessionId'],
  },
}
