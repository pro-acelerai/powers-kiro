import { randomUUID } from 'node:crypto'
import { isAbsolute, resolve } from 'node:path'
import { transition } from '../domain/state-machine.js'
import { assertInScope } from '../harness/scope.js'
import type { AppContext } from '../context.js'
import type { Attempt, ProposedChange, Session } from '../domain/types.js'

export async function handleSubmitProposedChange(
  args: {
    sessionId: string
    file: string
    operation: 'create' | 'modify' | 'delete'
    content: string
    justification: string
  },
  ctx: AppContext
) {
  const session = await ctx.store.load(args.sessionId)

  if (session.status !== 'PLANNING' && session.status !== 'PROPOSED') {
    throw new Error(
      `submit_proposed_change requires status PLANNING or PROPOSED, got ${session.status}. ` +
        `Call submit_plan first if you haven't planned yet.`
    )
  }

  // Resolve relative paths against the workspace (not the server's cwd) and store
  // the absolute path so every later step (apply, lint) operates on the same file.
  const resolvedFile = isAbsolute(args.file) ? args.file : resolve(ctx.workspacePath, args.file)

  // Harness validates scope before accepting the proposed change.
  assertInScope(resolvedFile, session.scope, ctx.workspacePath)

  const change: ProposedChange = {
    id: randomUUID(),
    attemptId: '',
    file: resolvedFile,
    operation: args.operation,
    content: args.operation === 'delete' ? '' : (args.content ?? ''),
    justification: args.justification,
    originalContent: null,
  }

  let updatedSession: Session

  if (session.status === 'PLANNING') {
    const attemptId = randomUUID()
    change.attemptId = attemptId

    const attempt: Attempt = {
      id: attemptId,
      sessionId: session.id,
      attemptNumber: session.attempts.length + 1,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'IN_PROGRESS',
      proposedChanges: [change],
      verificationResult: null,
    }

    const transResult = transition(session, 'PROPOSED')
    if (!transResult.ok) throw new Error(transResult.error)

    updatedSession = { ...transResult.session, attempts: [...session.attempts, attempt] }
  } else {
    // PROPOSED: accumulate in the existing IN_PROGRESS attempt
    const attempt = session.attempts.find(a => a.status === 'IN_PROGRESS')
    if (!attempt) throw new Error('No IN_PROGRESS attempt found. Cannot add more changes.')

    change.attemptId = attempt.id
    const updatedAttempt: Attempt = {
      ...attempt,
      proposedChanges: [...attempt.proposedChanges, change],
    }
    updatedSession = {
      ...session,
      attempts: session.attempts.map(a => (a.id === attempt.id ? updatedAttempt : a)),
    }
  }

  await ctx.store.save(updatedSession, session)

  const currentAttempt = updatedSession.attempts.find(a => a.status === 'IN_PROGRESS')!

  return {
    sessionId: session.id,
    status: updatedSession.status,
    changeId: change.id,
    totalChanges: currentAttempt.proposedChanges.length,
    proposedChanges: currentAttempt.proposedChanges.map(c => ({
      file: c.file,
      operation: c.operation,
      justification: c.justification,
    })),
    message:
      'Change recorded. Call submit_proposed_change again to add more files, ' +
      'or call request_human_approval when all changes are listed.',
  }
}

export const submitProposedChangeToolDefinition = {
  name: 'coding_submit_proposed_change',
  description:
    'Submit a proposed file change. Can be called multiple times to add changes for different files. ' +
    'First call (from PLANNING) creates a new attempt and transitions to PROPOSED. ' +
    'Subsequent calls (from PROPOSED) accumulate changes in the same attempt.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID' },
      file: {
        type: 'string',
        description: 'Absolute path to the file to create, modify, or delete',
      },
      operation: {
        type: 'string',
        enum: ['create', 'modify', 'delete'],
        description: 'Type of change: create a new file, modify an existing one, or delete it',
      },
      content: {
        type: 'string',
        description: 'Full new content for the file (ignored for delete operations)',
      },
      justification: {
        type: 'string',
        description: 'Why this change is necessary to implement the user story',
      },
    },
    required: ['sessionId', 'file', 'operation', 'content', 'justification'],
  },
}
