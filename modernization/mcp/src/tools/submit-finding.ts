import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { transition } from '../domain/state-machine.js'
import { assertInScope } from '../harness/scope.js'
import type { AppContext } from '../context.js'
import type { Finding, FindingClassification, FindingSeverity, DiscoverySession } from '../domain/types.js'

interface SubmitFindingArgs {
  sessionId: string
  file: string
  line?: number
  classification: FindingClassification
  severity: FindingSeverity
  title: string
  description: string
  recommendation: string
}

export async function handleSubmitFinding(args: SubmitFindingArgs, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'discovery') {
    throw new Error(`submit_finding requires a discovery session, got ${session.type}`)
  }

  if (session.status !== 'ANALYZING') {
    throw new Error(`submit_finding requires status ANALYZING, got ${session.status}`)
  }

  const validClassifications: FindingClassification[] = ['MIGRATE_AND_FIX', 'BLOCKER', 'DOCUMENT']
  if (!validClassifications.includes(args.classification)) {
    throw new Error(`classification must be one of: ${validClassifications.join(', ')}`)
  }

  const validSeverities: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info']
  if (!validSeverities.includes(args.severity)) {
    throw new Error(`severity must be one of: ${validSeverities.join(', ')}`)
  }

  if (!args.title?.trim()) throw new Error('title is required')
  if (!args.description?.trim()) throw new Error('description is required')
  if (!args.recommendation?.trim()) throw new Error('recommendation is required')

  const discovery = session as DiscoverySession

  // Validate file before constructing the Finding object
  if (!args.file?.trim()) throw new Error('file is required and must be a non-empty path')
  const absoluteFile = resolve(discovery.legacyPath, args.file.trim())
  assertInScope(absoluteFile, discovery.scope)

  const finding: Finding = {
    id: randomUUID(),
    sessionId: args.sessionId,
    createdAt: new Date().toISOString(),
    file: args.file,
    line: args.line ?? null,
    classification: args.classification,
    severity: args.severity,
    title: args.title.trim(),
    description: args.description.trim(),
    recommendation: args.recommendation.trim(),
    triageDecision: null,
  }

  const updatedFindings = [...discovery.findings, finding]
  const updated = { ...discovery, findings: updatedFindings }
  await ctx.store.save(updated, session)

  const blockerCount = updatedFindings.filter(f => f.classification === 'BLOCKER').length
  const migrateCount = updatedFindings.filter(f => f.classification === 'MIGRATE_AND_FIX').length
  const documentCount = updatedFindings.filter(f => f.classification === 'DOCUMENT').length

  return {
    sessionId: args.sessionId,
    findingId: finding.id,
    classification: finding.classification,
    severity: finding.severity,
    summary: {
      total: updatedFindings.length,
      BLOCKER: blockerCount,
      MIGRATE_AND_FIX: migrateCount,
      DOCUMENT: documentCount,
    },
    message: `Finding recorded (${finding.classification}). Continue submitting findings or call request_triage when done.`,
  }
}

export const submitFindingToolDefinition = {
  name: 'modernization_submit_finding',
  description:
    'Submit a finding discovered during legacy analysis. ' +
    'MIGRATE_AND_FIX: issue fixed in new system automatically (e.g. SQL injection, deprecated APIs). ' +
    'BLOCKER: issue that must be resolved before migration can be planned (requires human triage decision). ' +
    'DOCUMENT: known issue outside migration scope. ' +
    'Call once per finding. Accumulates in session.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The discovery session ID' },
      file: { type: 'string', description: 'File path where the finding was found (relative to legacy root)' },
      line: { type: 'number', description: 'Line number (optional)' },
      classification: {
        type: 'string',
        enum: ['MIGRATE_AND_FIX', 'BLOCKER', 'DOCUMENT'],
        description: 'How this finding should be handled',
      },
      severity: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low', 'info'],
        description: 'Finding severity',
      },
      title: { type: 'string', description: 'Short title of the finding' },
      description: { type: 'string', description: 'Full description of what was found and why it is a problem' },
      recommendation: { type: 'string', description: 'What should be done about it' },
    },
    required: ['sessionId', 'file', 'classification', 'severity', 'title', 'description', 'recommendation'],
  },
}
