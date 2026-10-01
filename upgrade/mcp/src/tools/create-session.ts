import { resolve, sep, isAbsolute } from 'node:path'
import type { AppContext } from '../context.js'

interface CreateAnalysisArgs {
  type: 'analysis'
  projectPath: string
  upgradeTarget: string
  scope: string[]
  validationCommand: string
  artifactsPath?: string
}

interface CreateExecutionArgs {
  type: 'execution'
  analysisSessionId: string
}

type CreateSessionArgs = CreateAnalysisArgs | CreateExecutionArgs

export async function handleCreateSession(args: CreateSessionArgs, ctx: AppContext) {
  if (!args.type) throw new Error('type is required: analysis | execution')

  switch (args.type) {
    case 'analysis': {
      const { projectPath, upgradeTarget, scope, validationCommand, artifactsPath } = args

      if (!projectPath?.trim()) throw new Error('projectPath is required')
      if (!upgradeTarget?.trim()) throw new Error('upgradeTarget is required')
      if (!validationCommand?.trim()) throw new Error('validationCommand is required')
      if (!Array.isArray(scope)) throw new Error('scope must be an array of paths')

      const trimmedArtifacts = artifactsPath?.trim()
      const resolvedArtifacts = trimmedArtifacts
        ? (isAbsolute(trimmedArtifacts)
            ? resolve(trimmedArtifacts)
            : resolve(ctx.workspacePath, trimmedArtifacts))
        : ctx.workspacePath

      const resolvedProject = isAbsolute(projectPath.trim())
        ? resolve(projectPath.trim())
        : resolve(ctx.workspacePath, projectPath.trim())

      const resolvedScope: string[] = scope.length === 0
        ? [resolvedProject]
        : scope.map(p => {
            const abs = isAbsolute(p.trim())
              ? resolve(p.trim())
              : resolve(resolvedProject, p.trim())
            const projectBase = resolvedProject.endsWith(sep) ? resolvedProject : resolvedProject + sep
            if (abs !== resolvedProject && !abs.startsWith(projectBase)) {
              throw new Error(
                `scope path "${p}" must be within the project directory: "${resolvedProject}"`
              )
            }
            return abs
          })

      const session = await ctx.store.createAnalysis({
        projectPath: resolvedProject,
        upgradeTarget: upgradeTarget.trim(),
        scope: resolvedScope,
        validationCommand: validationCommand.trim(),
        artifactsPath: resolvedArtifacts,
      })

      return {
        sessionId: session.id,
        type: session.type,
        status: session.status,
        projectPath: session.projectPath,
        upgradeTarget: session.upgradeTarget,
        scope: session.scope,
        validationCommand: session.validationCommand,
        artifactsPath: session.artifactsPath,
        refinementBudget: session.refinementBudget,
        message: 'Analysis session created. Call upgrade_read_project next.',
      }
    }

    case 'execution': {
      const { analysisSessionId } = args

      if (!analysisSessionId?.trim()) throw new Error('analysisSessionId is required')

      const analysisSession = await ctx.store.load(analysisSessionId)
      if (analysisSession.type !== 'analysis') {
        throw new Error('analysisSessionId must reference an analysis session')
      }
      if (analysisSession.status !== 'DONE') {
        throw new Error('Analysis session must be DONE before creating execution session')
      }

      const session = await ctx.store.createExecution({
        analysisSessionId,
        projectPath: analysisSession.projectPath,
        upgradeTarget: analysisSession.upgradeTarget,
        scope: analysisSession.scope,
        validationCommand: analysisSession.validationCommand,
        artifactsPath: analysisSession.artifactsPath,
      })

      return {
        sessionId: session.id,
        type: session.type,
        status: session.status,
        analysisSessionId: session.analysisSessionId,
        projectPath: session.projectPath,
        upgradeTarget: session.upgradeTarget,
        scope: session.scope,
        validationCommand: session.validationCommand,
        artifactsPath: session.artifactsPath,
        correctionBudget: session.correctionBudget,
        message: 'Execution session created. Call upgrade_read_analysis next.',
      }
    }

    default:
      throw new Error(`Unknown session type: ${(args as { type: string }).type}`)
  }
}

export const createSessionToolDefinition = {
  name: 'upgrade_create_session',
  description:
    'Create a new upgrade session. ' +
    'Use type="analysis" to start scanning a project for upgrade issues and planning changes. ' +
    'Use type="execution" after the analysis session is DONE to apply the planned changes in-place.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        enum: ['analysis', 'execution'],
        description: 'Session type: "analysis" to scan and plan, "execution" to apply changes',
      },
      projectPath: {
        type: 'string',
        description: '[analysis only] Absolute or relative path to the project to upgrade',
      },
      upgradeTarget: {
        type: 'string',
        description: '[analysis only] What to upgrade to (e.g. "Node.js 20 LTS", "React 18", "TypeScript 5.5")',
      },
      scope: {
        type: 'array',
        items: { type: 'string' },
        description: '[analysis only] Paths within projectPath to restrict the analysis. Empty array = entire project.',
      },
      validationCommand: {
        type: 'string',
        description: '[analysis only] Command to validate the project after changes (e.g. "npm test", "npm run build")',
      },
      artifactsPath: {
        type: 'string',
        description:
          '[analysis only] Base directory where trace and reports are written. ' +
          'Pass an ABSOLUTE path rooted at the user\'s workspace. ' +
          'Inherited automatically by the execution session. ' +
          'Defaults to the server-detected workspace when omitted.',
      },
      analysisSessionId: {
        type: 'string',
        description: '[execution only] ID of the completed analysis session',
      },
    },
    required: ['type'],
  },
}
