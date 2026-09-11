import { randomUUID } from 'node:crypto'
import { resolve, isAbsolute } from 'node:path'
import type { AppContext } from '../context.js'
import type { AnalysisSession, Issue, IssueType, IssueSeverity, IssueStatus } from '../domain/types.js'
import { assertInScope } from '../harness/scope.js'

interface SubmitIssueArgs {
  sessionId: string
  file: string
  line?: number | null
  type: IssueType
  severity: IssueSeverity
  status: IssueStatus
  title: string
  description: string
  recommendation: string
}

export async function handleSubmitIssue(args: SubmitIssueArgs, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'analysis') {
    throw new Error(`upgrade_submit_issue requires an analysis session, got ${session.type}`)
  }

  if (session.status !== 'SCANNING') {
    throw new Error(`upgrade_submit_issue requires status SCANNING, got ${session.status}`)
  }

  if (!args.file?.trim()) throw new Error('file is required')
  if (!args.type) throw new Error('type is required')
  if (!args.severity) throw new Error('severity is required')
  if (!args.status) throw new Error('status is required')
  if (!args.title?.trim()) throw new Error('title is required')
  if (!args.description?.trim()) throw new Error('description is required')
  if (!args.recommendation?.trim()) throw new Error('recommendation is required')

  const analysis = session as AnalysisSession

  const absoluteFile = isAbsolute(args.file.trim())
    ? resolve(args.file.trim())
    : resolve(analysis.projectPath, args.file.trim())

  assertInScope(absoluteFile, analysis.scope)

  const issue: Issue = {
    id: randomUUID(),
    sessionId: args.sessionId,
    createdAt: new Date().toISOString(),
    file: absoluteFile,
    line: args.line ?? null,
    type: args.type,
    severity: args.severity,
    status: args.status,
    title: args.title.trim(),
    description: args.description.trim(),
    recommendation: args.recommendation.trim(),
  }

  const updated = { ...analysis, issues: [...analysis.issues, issue] }
  await ctx.store.save(updated, session)

  return {
    sessionId: args.sessionId,
    issueId: issue.id,
    file: absoluteFile,
    type: issue.type,
    severity: issue.severity,
    status: issue.status,
    title: issue.title,
    totalIssues: updated.issues.length,
    message: `Issue recorded. Total issues: ${updated.issues.length}. Submit more issues or call upgrade_submit_plan when done.`,
  }
}

export const submitIssueToolDefinition = {
  name: 'upgrade_submit_issue',
  description:
    'Record an upgrade issue found during project scanning. ' +
    'Issues represent breaking changes, deprecations, CVEs, or other problems ' +
    'that need to be addressed when upgrading to the target version.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The analysis session ID' },
      file: {
        type: 'string',
        description: 'File path where the issue was found (absolute or relative to projectPath)',
      },
      line: {
        type: 'number',
        description: 'Line number where the issue occurs (optional)',
      },
      type: {
        type: 'string',
        enum: ['breaking_api', 'deprecated_usage', 'cve', 'syntax_idiom', 'toolchain', 'incompatible_dep'],
        description: 'Category of the issue',
      },
      severity: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low'],
        description: 'How severe the issue is',
      },
      status: {
        type: 'string',
        enum: ['must_fix', 'recommended', 'optional'],
        description: 'Whether fixing this issue is required to complete the upgrade',
      },
      title: { type: 'string', description: 'Short title of the issue' },
      description: { type: 'string', description: 'Detailed description of the problem' },
      recommendation: { type: 'string', description: 'How to fix or address the issue' },
    },
    required: ['sessionId', 'file', 'type', 'severity', 'status', 'title', 'description', 'recommendation'],
  },
}
