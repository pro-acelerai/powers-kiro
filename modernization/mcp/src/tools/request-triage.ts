import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { DiscoverySession } from '../domain/types.js'

export async function handleRequestTriage(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'discovery') {
    throw new Error(`request_triage requires a discovery session, got ${session.type}`)
  }

  if (session.status !== 'ANALYZING') {
    throw new Error(`request_triage requires status ANALYZING, got ${session.status}`)
  }

  const discovery = session as DiscoverySession
  const blockers = discovery.findings.filter(f => f.classification === 'BLOCKER')

  if (blockers.length === 0) {
    // No blockers — skip triage, go straight to SPECIFYING
    const transResult = transition(session, 'SPECIFYING')
    if (!transResult.ok) throw new Error(transResult.error)
    await ctx.store.save(transResult.session, session)

    return {
      sessionId: session.id,
      status: 'SPECIFYING',
      blockersFound: 0,
      triageRequired: false,
      message: 'No BLOCKER findings. Skipping triage. Proceed to submit_specification.',
    }
  }

  // Has blockers — transition to TRIAGE_REVIEW and surface them
  const transResult = transition(session, 'TRIAGE_REVIEW')
  if (!transResult.ok) throw new Error(transResult.error)
  await ctx.store.save(transResult.session, session)

  return {
    sessionId: session.id,
    status: 'TRIAGE_REVIEW',
    blockersFound: blockers.length,
    triageRequired: true,
    blockers: blockers.map(f => ({
      id: f.id,
      file: f.file,
      line: f.line,
      severity: f.severity,
      title: f.title,
      description: f.description,
      recommendation: f.recommendation,
    })),
    message:
      `Found ${blockers.length} BLOCKER(s). Present these to the user and request a decision for each: ` +
      `"fix_before" (fix in legacy before migrating), "descope" (remove from migration scope), ` +
      `or "accept_risk" (acknowledge risk and continue). Then call submit_triage_decisions with the results.`,
  }
}

export const requestTriageToolDefinition = {
  name: 'modernization_request_triage',
  description:
    'Check for BLOCKER findings and request human triage decisions. ' +
    'If no BLOCKERs exist, automatically advances to SPECIFYING. ' +
    'If BLOCKERs exist, transitions to TRIAGE_REVIEW and returns the list for human review. ' +
    'Call after all findings have been submitted.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The discovery session ID' },
    },
    required: ['sessionId'],
  },
}
