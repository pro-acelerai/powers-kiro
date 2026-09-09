import { randomUUID } from 'node:crypto'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { DiscoverySession, TriageDecision, TriageResolution } from '../domain/types.js'

interface TriageDecisionInput {
  findingId: string
  resolution: TriageResolution
  notes: string
}

export async function handleSubmitTriageDecisions(
  args: { sessionId: string; decisions: TriageDecisionInput[] },
  ctx: AppContext
) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'discovery') {
    throw new Error(`submit_triage_decisions requires a discovery session, got ${session.type}`)
  }

  if (session.status !== 'TRIAGE_REVIEW') {
    throw new Error(`submit_triage_decisions requires status TRIAGE_REVIEW, got ${session.status}`)
  }

  if (!Array.isArray(args.decisions) || args.decisions.length === 0) {
    throw new Error('decisions must be a non-empty array')
  }

  const validResolutions: TriageResolution[] = ['fix_before', 'descope', 'accept_risk']
  for (const d of args.decisions) {
    if (!validResolutions.includes(d.resolution)) {
      throw new Error(`Invalid resolution "${d.resolution}". Must be one of: ${validResolutions.join(', ')}`)
    }
  }

  const discovery = session as DiscoverySession
  const blockers = discovery.findings.filter(f => f.classification === 'BLOCKER')

  const decisionMap = new Map(args.decisions.map(d => [d.findingId, d]))

  // Validate all submitted findingIds exist in this session's findings
  const allFindingIds = new Set(discovery.findings.map(f => f.id))
  const unknownIds = args.decisions.filter(d => !allFindingIds.has(d.findingId))
  if (unknownIds.length > 0) {
    throw new Error(`Unknown findingIds: ${unknownIds.map(d => d.findingId).join(', ')}`)
  }

  // L6: reject decisions for non-BLOCKER findings (only BLOCKERs require triage)
  const nonBlockerDecisions = args.decisions.filter(d => {
    const finding = discovery.findings.find(f => f.id === d.findingId)
    return finding && finding.classification !== 'BLOCKER'
  })
  if (nonBlockerDecisions.length > 0) {
    throw new Error(
      `Decisions submitted for non-BLOCKER finding(s): ${nonBlockerDecisions.map(d => d.findingId).join(', ')}. ` +
      `Only BLOCKER findings require triage decisions.`
    )
  }

  const missingDecisions = blockers.filter(b => !decisionMap.has(b.id))

  if (missingDecisions.length > 0) {
    throw new Error(
      `Missing decisions for BLOCKERs: ${missingDecisions.map(b => `${b.id} (${b.title})`).join(', ')}`
    )
  }

  const now = new Date().toISOString()
  const updatedFindings = discovery.findings.map(f => {
    const dec = decisionMap.get(f.id)
    // Issue 10: only apply triage decisions to BLOCKER findings
    if (!dec || f.classification !== 'BLOCKER') return f

    const triageDecision: TriageDecision = {
      id: randomUUID(),
      findingId: f.id,
      decidedAt: now,
      resolution: dec.resolution,
      notes: dec.notes ?? '',
    }
    return { ...f, triageDecision }
  })

  const transResult = transition(session, 'SPECIFYING')
  if (!transResult.ok) throw new Error(transResult.error)

  const updated = { ...transResult.session, findings: updatedFindings } as DiscoverySession
  await ctx.store.save(updated, session)

  const summary = args.decisions.reduce(
    (acc, d) => {
      acc[d.resolution] = (acc[d.resolution] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return {
    sessionId: session.id,
    status: 'SPECIFYING',
    decisionsRecorded: args.decisions.length,
    summary,
    message: 'Triage decisions recorded. Proceed to submit_think then submit_specification.',
  }
}

export const submitTriageDecisionsToolDefinition = {
  name: 'modernization_submit_triage_decisions',
  description:
    'Submit human triage decisions for BLOCKER findings. ' +
    'Each BLOCKER must have a decision: ' +
    '"fix_before" (user will fix in legacy before continuing), ' +
    '"descope" (remove from migration scope entirely), ' +
    '"accept_risk" (acknowledge the risk, new system will not replicate the bug). ' +
    'Transitions session to SPECIFYING.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The discovery session ID' },
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            findingId: { type: 'string', description: 'ID of the BLOCKER finding' },
            resolution: {
              type: 'string',
              enum: ['fix_before', 'descope', 'accept_risk'],
            },
            notes: { type: 'string', description: 'Notes from the human decision' },
          },
          required: ['findingId', 'resolution', 'notes'],
        },
        description: 'One decision per BLOCKER finding',
      },
    },
    required: ['sessionId', 'decisions'],
  },
}
