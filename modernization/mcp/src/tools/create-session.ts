import { resolve, sep } from 'node:path'
import type { AppContext } from '../context.js'

interface CreateDiscoveryArgs {
  type: 'discovery'
  legacyPath: string
  targetStack: string
  scope: string[]
  artifactsPath?: string
}

interface CreateArchitectureArgs {
  type: 'architecture'
  discoverySessionId: string
}

interface CreateImplementationArgs {
  type: 'implementation'
  discoverySessionId: string
  architectureSessionId: string
  phaseId: string
  phaseNumber: number
  phaseTitle: string
}

interface CreateDeliveryArgs {
  type: 'delivery'
  discoverySessionId: string
  architectureSessionId: string
  implementationSessionIds: string[]
}

type CreateSessionArgs =
  | CreateDiscoveryArgs
  | CreateArchitectureArgs
  | CreateImplementationArgs
  | CreateDeliveryArgs

export async function handleCreateSession(args: CreateSessionArgs, ctx: AppContext) {
  if (!args.type) throw new Error('type is required: discovery | architecture | implementation | delivery')

  switch (args.type) {
    case 'discovery': {
      const { legacyPath, targetStack, scope, artifactsPath } = args
      if (!legacyPath?.trim()) throw new Error('legacyPath is required')
      if (!targetStack?.trim()) throw new Error('targetStack is required')
      if (!Array.isArray(scope) || scope.length === 0) throw new Error('scope must be a non-empty array of paths')

      // artifactsPath: base directory for all artifacts of this iteration.
      // Confirmed by the user at the start of discovery. Defaults to the
      // resolved workspace root when the agent does not provide one.
      // Must resolve within the workspace so artifacts never leak outside it.
      const resolvedArtifacts = artifactsPath?.trim()
        ? resolve(ctx.workspacePath, artifactsPath.trim())
        : ctx.workspacePath
      if (resolvedArtifacts !== ctx.workspacePath && !resolvedArtifacts.startsWith(ctx.workspacePath + sep)) {
        throw new Error(
          `artifactsPath "${artifactsPath}" resolves outside the workspace: "${ctx.workspacePath}". ` +
          `Use a path within the workspace.`
        )
      }

      // legacyPath may live anywhere on disk (only read, never written)
      const resolvedLegacy = resolve(ctx.workspacePath, legacyPath.trim())
      // scope paths must be within the legacy project, not necessarily the workspace
      const resolvedScope = scope.map(p => {
        const resolved = resolve(resolvedLegacy, p.trim())
        if (resolved !== resolvedLegacy && !resolved.startsWith(resolvedLegacy + sep)) {
          throw new Error(`scope path "${p}" must be within the legacy project directory: "${resolvedLegacy}"`)
        }
        return resolved
      })

      const session = await ctx.store.createDiscovery({
        legacyPath: resolvedLegacy,
        targetStack: targetStack.trim(),
        scope: resolvedScope,
        artifactsPath: resolvedArtifacts,
      })

      return {
        sessionId: session.id,
        type: session.type,
        status: session.status,
        legacyPath: session.legacyPath,
        targetStack: session.targetStack,
        scope: session.scope,
        artifactsPath: session.artifactsPath,
        refinementBudget: session.refinementBudget,
        message: 'Discovery session created. Call read_legacy next.',
      }
    }

    case 'architecture': {
      const { discoverySessionId } = args
      if (!discoverySessionId?.trim()) throw new Error('discoverySessionId is required')

      const discoverySession = await ctx.store.load(discoverySessionId)
      if (discoverySession.type !== 'discovery') throw new Error('discoverySessionId must reference a discovery session')
      if (discoverySession.status !== 'DONE') throw new Error('Discovery session must be DONE before creating architecture session')

      // Inherit the artifacts path confirmed at the start of discovery.
      const session = await ctx.store.createArchitecture({
        discoverySessionId,
        artifactsPath: discoverySession.artifactsPath,
      })

      return {
        sessionId: session.id,
        type: session.type,
        status: session.status,
        discoverySessionId: session.discoverySessionId,
        artifactsPath: session.artifactsPath,
        refinementBudget: session.refinementBudget,
        message: 'Architecture session created. Call read_discovery next.',
      }
    }

    case 'implementation': {
      const { discoverySessionId, architectureSessionId, phaseId, phaseNumber, phaseTitle } = args
      if (!discoverySessionId?.trim()) throw new Error('discoverySessionId is required')
      if (!architectureSessionId?.trim()) throw new Error('architectureSessionId is required')
      if (!phaseId?.trim()) throw new Error('phaseId is required')
      if (!phaseNumber || phaseNumber < 1) throw new Error('phaseNumber must be >= 1')
      if (!phaseTitle?.trim()) throw new Error('phaseTitle is required')

      // Issue 7: validate discoverySessionId
      const discSession = await ctx.store.load(discoverySessionId)
      if (discSession.type !== 'discovery') throw new Error('discoverySessionId must reference a discovery session')
      if (discSession.status !== 'DONE') throw new Error('Discovery session must be DONE before creating implementation session')

      const archSession = await ctx.store.load(architectureSessionId)
      if (archSession.type !== 'architecture') throw new Error('architectureSessionId must reference an architecture session')
      if (archSession.status !== 'DONE') throw new Error('Architecture session must be DONE before creating implementation session')
      if (!archSession.migrationPlan) throw new Error('Architecture session has no migration plan')

      // Issue 8: validate phaseId exists in migration plan
      const phase = archSession.migrationPlan.phases.find(p => p.id === phaseId)
      if (!phase) {
        const validIds = archSession.migrationPlan.phases.map(p => p.id).join(', ')
        throw new Error(`phaseId "${phaseId}" not found in migration plan. Valid ids: ${validIds}`)
      }

      // Issue 6: use the path from the migration plan directly (not resolve into it)
      const newProjectPath = archSession.migrationPlan.newProjectPath

      const session = await ctx.store.createImplementation({
        discoverySessionId,
        architectureSessionId,
        phaseId,
        phaseNumber: phase.number,
        phaseTitle: phase.title,
        newProjectPath,
        // Inherit the artifacts path confirmed at the start of discovery.
        artifactsPath: discSession.artifactsPath,
      })

      return {
        sessionId: session.id,
        type: session.type,
        status: session.status,
        phaseNumber: session.phaseNumber,
        phaseTitle: session.phaseTitle,
        newProjectPath: session.newProjectPath,
        artifactsPath: session.artifactsPath,
        correctionBudget: session.correctionBudget,
        message: `Implementation session created for Phase ${phaseNumber}: ${phaseTitle}. Call read_phase_context next.`,
      }
    }

    case 'delivery': {
      const { discoverySessionId, architectureSessionId, implementationSessionIds } = args
      if (!discoverySessionId?.trim()) throw new Error('discoverySessionId is required')
      if (!architectureSessionId?.trim()) throw new Error('architectureSessionId is required')
      if (!Array.isArray(implementationSessionIds) || implementationSessionIds.length === 0) {
        throw new Error('implementationSessionIds must be a non-empty array')
      }

      // M4: validate discoverySessionId and architectureSessionId
      const delivDiscovSession = await ctx.store.load(discoverySessionId)
      if (delivDiscovSession.type !== 'discovery') throw new Error('discoverySessionId must reference a discovery session')
      if (delivDiscovSession.status !== 'DONE') throw new Error('Discovery session must be DONE before creating delivery session')
      if (!delivDiscovSession.specification) throw new Error('Discovery session has no specification')

      const delivArchSession = await ctx.store.load(architectureSessionId)
      if (delivArchSession.type !== 'architecture') throw new Error('architectureSessionId must reference an architecture session')
      if (delivArchSession.status !== 'DONE') throw new Error('Architecture session must be DONE before creating delivery session')
      if (!delivArchSession.migrationPlan) throw new Error('Architecture session has no migration plan')

      // Issue 30: validate each implementation session is DONE before creating delivery
      for (const implId of implementationSessionIds) {
        const implSession = await ctx.store.load(implId)
        if (implSession.type !== 'implementation') {
          throw new Error(`Session ${implId} is not an implementation session`)
        }
        if (implSession.status !== 'DONE') {
          throw new Error(
            `Implementation session ${implId} (Phase ${implSession.phaseNumber}) is not DONE (status: ${implSession.status}). ` +
            `All implementation sessions must be DONE before creating a delivery session.`
          )
        }
      }

      const session = await ctx.store.createDelivery({
        discoverySessionId,
        architectureSessionId,
        implementationSessionIds,
        // Inherit the artifacts path confirmed at the start of discovery.
        artifactsPath: delivDiscovSession.artifactsPath,
      })

      return {
        sessionId: session.id,
        type: session.type,
        status: session.status,
        artifactsPath: session.artifactsPath,
        message: 'Delivery session created. Call generate_report next.',
      }
    }

    default:
      throw new Error(`Unknown session type: ${(args as { type: string }).type}`)
  }
}

export const createSessionToolDefinition = {
  name: 'modernization_create_session',
  description:
    'Create a new modernization session. ' +
    'Session type determines the phase: discovery (analyze legacy), architecture (plan migration), ' +
    'implementation (build new project phase), delivery (generate final report). ' +
    'Must be called first before any other modernization tool for that phase.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        enum: ['discovery', 'architecture', 'implementation', 'delivery'],
        description: 'The session type / migration phase',
      },
      legacyPath: {
        type: 'string',
        description: '[discovery only] Absolute or relative path to the legacy project root',
      },
      targetStack: {
        type: 'string',
        description: '[discovery only] Target technology stack description (e.g. "Node.js + TypeScript + Fastify + Prisma")',
      },
      scope: {
        type: 'array',
        items: { type: 'string' },
        description: '[discovery only] Array of folders or files to analyze from the legacy project',
      },
      artifactsPath: {
        type: 'string',
        description:
          '[discovery only] Base directory (within the workspace) where all artifacts of this ' +
          'iteration are written: HTML report, final report and the new project. ' +
          'Suggest a path to the user and confirm it before creating the session. ' +
          'Inherited automatically by architecture, implementation and delivery sessions. ' +
          'Defaults to the workspace root when omitted.',
      },
      discoverySessionId: {
        type: 'string',
        description: '[architecture, implementation, delivery] ID of the completed discovery session',
      },
      architectureSessionId: {
        type: 'string',
        description: '[implementation, delivery] ID of the completed architecture session',
      },
      phaseId: {
        type: 'string',
        description: '[implementation] ID of the phase from the migration plan',
      },
      phaseNumber: {
        type: 'number',
        description: '[implementation] Phase number (1, 2, 3...)',
      },
      phaseTitle: {
        type: 'string',
        description: '[implementation] Title of the phase being implemented',
      },
      implementationSessionIds: {
        type: 'array',
        items: { type: 'string' },
        description: '[delivery] IDs of all completed implementation sessions',
      },
    },
    required: ['type'],
  },
}
