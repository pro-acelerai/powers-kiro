import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { ArchitectureSession, DiscoverySession } from '../domain/types.js'

export async function handleReadDiscovery(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'architecture') {
    throw new Error(`read_discovery requires an architecture session, got ${session.type}`)
  }

  if (session.status !== 'CREATED') {
    throw new Error(`read_discovery requires status CREATED, got ${session.status}`)
  }

  const arch = session as ArchitectureSession

  const discoverySession = await ctx.store.load(arch.discoverySessionId)
  if (discoverySession.type !== 'discovery') {
    throw new Error('Referenced session is not a discovery session')
  }
  if (discoverySession.status !== 'DONE') {
    throw new Error('Discovery session is not yet DONE')
  }

  const discovery = discoverySession as DiscoverySession
  if (!discovery.specification) {
    throw new Error('Discovery session has no specification — cannot proceed with architecture')
  }

  const transResult = transition(session, 'PLANNING')
  if (!transResult.ok) throw new Error(transResult.error)
  await ctx.store.save(transResult.session, session)

  const { specification } = discovery
  const blockersSummary = discovery.findings
    .filter(f => f.classification === 'BLOCKER')
    .map(f => ({
      title: f.title,
      resolution: f.triageDecision?.resolution ?? 'unresolved',
      notes: f.triageDecision?.notes ?? '',
    }))

  return {
    sessionId: session.id,
    status: 'PLANNING',
    discoverySessionId: arch.discoverySessionId,
    targetStack: discovery.targetStack,
    legacyPath: discovery.legacyPath,
    specification: {
      id: specification.id,
      version: specification.version,
      domainEntities: specification.domainEntities,
      businessRules: specification.businessRules,
      flows: specification.flows,
      externalContracts: specification.externalContracts,
      databaseRules: specification.databaseRules ?? [],
      excludedScope: specification.excludedScope ?? [],
      nonFunctional: specification.nonFunctional,
      rawMarkdown: specification.rawMarkdown,
    },
    findingsSummary: {
      total: discovery.findings.length,
      BLOCKER: blockersSummary,
      MIGRATE_AND_FIX: discovery.findings.filter(f => f.classification === 'MIGRATE_AND_FIX').length,
      DOCUMENT: discovery.findings.filter(f => f.classification === 'DOCUMENT').length,
    },
    message:
      'Discovery context loaded. Use submit_think to record architecture reasoning, ' +
      'then submit_migration_plan with the phased migration plan.',
  }
}

export const readDiscoveryToolDefinition = {
  name: 'modernization_read_discovery',
  description:
    'Load the specification and findings from the completed discovery session. ' +
    'Transitions the architecture session from CREATED to PLANNING. ' +
    'Returns the full spec (entities, rules, flows, contracts) and findings summary ' +
    'for the agent to design the migration architecture.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The architecture session ID' },
    },
    required: ['sessionId'],
  },
}
