import { resolve } from 'node:path'
import type { AppContext } from '../context.js'

interface CreateSessionArgs {
  userStory: string
  scope: string[]
}

export async function handleCreateSession(args: CreateSessionArgs, ctx: AppContext) {
  const { userStory, scope } = args

  if (!userStory?.trim()) {
    throw new Error('userStory is required and cannot be empty')
  }

  if (!Array.isArray(scope) || scope.length === 0) {
    throw new Error('scope must be a non-empty array of paths')
  }

  // Resolve scope paths against workspace so they are always absolute
  const resolvedScope = scope.map(p => resolve(ctx.workspacePath, p))

  const session = await ctx.store.create({
    userStory: userStory.trim(),
    scope: resolvedScope,
  })

  return {
    sessionId: session.id,
    status: session.status,
    correctionBudget: session.correctionBudget,
    scope: session.scope,
    message: 'Session created. Call read_scope next.',
  }
}

export const createSessionToolDefinition = {
  name: 'coding_create_session',
  description:
    'Create a new governed coding session for a user story. ' +
    'Must be called first before any other coding tool.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      userStory: {
        type: 'string',
        description: 'The full text of the user story, or a file path to a .md file containing it',
      },
      scope: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of folder or file paths the Harness is authorized to read and modify',
      },
    },
    required: ['userStory', 'scope'],
  },
}
