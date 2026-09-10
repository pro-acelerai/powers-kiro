import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type {
  DiscoverySession,
  Specification,
  SpecEntity,
  SpecRule,
  SpecFlow,
  SpecContract,
  DatabaseRule,
  ExcludedScope,
} from '../domain/types.js'

interface SubmitSpecArgs {
  sessionId: string
  domainEntities: SpecEntity[]
  businessRules: SpecRule[]
  flows: SpecFlow[]
  externalContracts: SpecContract[]
  databaseRules: DatabaseRule[]
  excludedScope: ExcludedScope[]
  nonFunctional: string[]
  rawMarkdown: string
}

export async function handleSubmitSpecification(args: SubmitSpecArgs, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'discovery') {
    throw new Error(`submit_specification requires a discovery session, got ${session.type}`)
  }

  if (session.status !== 'SPECIFYING') {
    throw new Error(`submit_specification requires status SPECIFYING, got ${session.status}`)
  }

  if (!args.rawMarkdown?.trim()) throw new Error('rawMarkdown is required')
  if (!Array.isArray(args.domainEntities)) throw new Error('domainEntities must be an array')
  if (!Array.isArray(args.businessRules)) throw new Error('businessRules must be an array')
  if (!Array.isArray(args.flows)) throw new Error('flows must be an array')

  const discovery = session as DiscoverySession
  const version = (discovery.specification?.version ?? 0) + 1

  const NA = '(não informado)'

  const specification: Specification = {
    id: randomUUID(),
    sessionId: args.sessionId,
    createdAt: new Date().toISOString(),
    version,
    domainEntities: (args.domainEntities ?? []).map(e => ({
      name: e.name ?? NA,
      description: e.description ?? NA,
      attributes: Array.isArray(e.attributes) ? e.attributes.map(a => a ?? NA) : [],
    })),
    businessRules: (args.businessRules ?? []).map(r => ({
      id: r.id ?? randomUUID(),
      title: r.title ?? NA,
      description: r.description ?? NA,
      sourceRef: r.sourceRef ?? NA,
    })),
    flows: (args.flows ?? []).map(f => ({
      id: f.id ?? randomUUID(),
      name: f.name ?? NA,
      steps: Array.isArray(f.steps) ? f.steps.map(s => s ?? NA) : [],
      sourceRef: f.sourceRef ?? NA,
    })),
    externalContracts: (args.externalContracts ?? []).map(c => ({
      id: c.id ?? randomUUID(),
      type: c.type ?? 'external_service',
      name: c.name ?? NA,
      description: c.description ?? NA,
      sourceRef: c.sourceRef ?? NA,
    })),
    databaseRules: (args.databaseRules ?? []).map(r => ({
      id: r.id ?? randomUUID(),
      name: r.name ?? NA,
      type: r.type ?? 'other',
      description: r.description ?? NA,
      decision: r.decision ?? 'keep_as_is',
      rationale: r.rationale ?? NA,
      sourceRef: r.sourceRef ?? NA,
    })),
    excludedScope: (args.excludedScope ?? []).map(e => ({
      path: e.path ?? NA,
      reason: e.reason ?? NA,
    })),
    nonFunctional: (args.nonFunctional ?? []).map(n => n ?? NA),
    rawMarkdown: args.rawMarkdown.trim(),
  }

  const transResult = transition(session, 'SPEC_REVIEW')
  if (!transResult.ok) throw new Error(transResult.error)

  const updated = { ...transResult.session, specification } as DiscoverySession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'SPEC_REVIEW',
    specId: specification.id,
    version: specification.version,
    summary: {
      domainEntities: specification.domainEntities.length,
      businessRules: specification.businessRules.length,
      flows: specification.flows.length,
      externalContracts: specification.externalContracts.length,
      databaseRules: specification.databaseRules.length,
      excludedScope: specification.excludedScope.length,
    },
    specMarkdown: specification.rawMarkdown,
    message:
      'Specification submitted. Present the spec to the user for review. ' +
      'Wait for approval then call request_spec_approval with their decision.',
  }
}

export const submitSpecificationToolDefinition = {
  name: 'modernization_submit_specification',
  description:
    'Submit the extracted system specification. ' +
    'The spec captures the INTENT of the legacy system (business rules, domain entities, flows, contracts) ' +
    'independent of how it was implemented. ' +
    'The new system will be built from this spec, not from the legacy code directly. ' +
    'Transitions to SPEC_REVIEW for human validation.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The discovery session ID' },
      domainEntities: {
        type: 'array',
        description: 'Core domain entities (data models)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            attributes: { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'description', 'attributes'],
        },
      },
      businessRules: {
        type: 'array',
        description: 'Business rules extracted from the legacy code',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            sourceRef: { type: 'string', description: 'Legacy file:line where this rule was found' },
          },
          required: ['id', 'title', 'description', 'sourceRef'],
        },
      },
      flows: {
        type: 'array',
        description: 'Main user/system flows',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } },
            sourceRef: { type: 'string' },
          },
          required: ['id', 'name', 'steps', 'sourceRef'],
        },
      },
      externalContracts: {
        type: 'array',
        description: 'External integrations (APIs, databases, events)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['rest_api', 'event', 'database', 'external_service'] },
            name: { type: 'string' },
            description: { type: 'string' },
            sourceRef: { type: 'string' },
          },
          required: ['id', 'type', 'name', 'description', 'sourceRef'],
        },
      },
      databaseRules: {
        type: 'array',
        description:
          'Database-level logic found in the legacy system that requires an explicit migration decision: ' +
          'triggers, stored procedures, scheduled jobs, views, functions. ' +
          'For each one, record what it does and whether to migrate, reimplement in the application layer, drop, or keep as-is.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', description: 'Name of the DB object (e.g. trg_after_insert_orders)' },
            type: { type: 'string', enum: ['trigger', 'stored_procedure', 'scheduled_job', 'view', 'function', 'other'] },
            description: { type: 'string', description: 'What this DB object does in business terms' },
            decision: { type: 'string', enum: ['migrate', 'reimplement_in_application', 'drop', 'keep_as_is'] },
            rationale: { type: 'string', description: 'Why this decision was made' },
            sourceRef: { type: 'string', description: 'File or DB schema location where this was found' },
          },
          required: ['id', 'name', 'type', 'description', 'decision', 'rationale', 'sourceRef'],
        },
      },
      excludedScope: {
        type: 'array',
        description:
          'Files, modules, or subsystems explicitly excluded from the migration scope. ' +
          'Documents what will NOT be migrated and why — important for stakeholder alignment.',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File or directory path excluded' },
            reason: { type: 'string', description: 'Why this path is excluded from migration' },
          },
          required: ['path', 'reason'],
        },
      },
      nonFunctional: {
        type: 'array',
        items: { type: 'string' },
        description: 'Non-functional requirements found (performance, security constraints, known limitations)',
      },
      rawMarkdown: {
        type: 'string',
        description: 'Human-readable Markdown version of the full specification for the review gate',
      },
    },
    required: ['sessionId', 'domainEntities', 'businessRules', 'flows', 'rawMarkdown'],
  },
}
