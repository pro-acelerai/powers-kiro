import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { ExecutionSession, AnalysisSession } from '../domain/types.js'

export async function handleReadAnalysis(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'execution') {
    throw new Error(`upgrade_read_analysis requires an execution session, got ${session.type}`)
  }

  if (session.status !== 'CREATED') {
    throw new Error(`upgrade_read_analysis requires status CREATED, got ${session.status}`)
  }

  const exec = session as ExecutionSession

  const analysisSession = await ctx.store.load(exec.analysisSessionId)

  if (analysisSession.type !== 'analysis') {
    throw new Error('analysisSessionId does not reference an analysis session')
  }

  if (analysisSession.status !== 'DONE') {
    throw new Error('Analysis session must be DONE')
  }

  const analysis = analysisSession as AnalysisSession

  const transResult = transition(session, 'LOADING')
  if (!transResult.ok) throw new Error(transResult.error)

  await ctx.store.save(transResult.session, session)

  return {
    sessionId: args.sessionId,
    status: 'LOADING',
    analysisSessionId: exec.analysisSessionId,
    projectPath: analysis.projectPath,
    upgradeTarget: analysis.upgradeTarget,
    scope: analysis.scope,
    validationCommand: analysis.validationCommand,
    totalIssues: analysis.issues.length,
    issues: analysis.issues,
    plan: analysis.plan,
    message: 'Analysis data loaded. Review issues and plan, then use upgrade_submit_file_change to queue changes.',
  }
}

export const readAnalysisToolDefinition = {
  name: 'upgrade_read_analysis',
  description:
    'Load the analysis session data into the execution session. ' +
    'Returns all found issues and the approved upgrade plan. ' +
    'Transitions the execution session from CREATED to LOADING. ' +
    'Must be called before submitting file changes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The execution session ID' },
    },
    required: ['sessionId'],
  },
}
