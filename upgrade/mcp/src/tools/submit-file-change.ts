import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, isAbsolute } from 'node:path'
import type { AppContext } from '../context.js'
import type { ExecutionSession, FileChange, ChangeOperation } from '../domain/types.js'
import { assertInScope } from '../harness/scope.js'
import { getCurrentAttempt } from './attempt-utils.js'

interface SubmitFileChangeArgs {
  sessionId: string
  file: string
  operation: ChangeOperation
  content: string
  justification: string
  issueRefs?: string[]
}

export async function handleSubmitFileChange(args: SubmitFileChangeArgs, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'execution') {
    throw new Error(`upgrade_submit_file_change requires an execution session, got ${session.type}`)
  }

  const allowedStatuses = ['LOADING', 'CORRECTING'] as const
  if (!allowedStatuses.includes(session.status as typeof allowedStatuses[number])) {
    throw new Error(`upgrade_submit_file_change requires status LOADING or CORRECTING, got ${session.status}`)
  }

  if (!args.file?.trim()) throw new Error('file path is required')
  if (args.content === undefined || args.content === null) throw new Error('content is required (use empty string for deletions)')
  if (!args.justification?.trim()) throw new Error('justification is required')

  const validOperations: ChangeOperation[] = ['create', 'modify', 'delete']
  if (!validOperations.includes(args.operation)) {
    throw new Error(`operation must be one of: ${validOperations.join(', ')}`)
  }

  const exec = session as ExecutionSession

  const absoluteFile = isAbsolute(args.file.trim())
    ? resolve(args.file.trim())
    : resolve(exec.projectPath, args.file.trim())

  assertInScope(absoluteFile, exec.scope)

  let attempt = getCurrentAttempt(exec)

  if (!attempt) {
    if (session.status === 'CORRECTING') {
      throw new Error(
        'No IN_PROGRESS attempt found. In CORRECTING state, call upgrade_submit_correction first to authorize and start a new attempt.'
      )
    }
    // LOADING: create the first attempt lazily
    attempt = {
      id: randomUUID(),
      sessionId: args.sessionId,
      attemptNumber: exec.attempts.length + 1,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'IN_PROGRESS' as const,
      fileChanges: [],
      validationResult: null,
    }
  }

  // Read original content if modify or delete and not yet captured
  let originalContent: string | null = null
  if (args.operation === 'modify' || args.operation === 'delete') {
    const existing = attempt.fileChanges.find(fc => fc.file === absoluteFile)
    if (existing?.originalContent !== null && existing?.originalContent !== undefined) {
      originalContent = existing.originalContent
    } else {
      try {
        originalContent = await readFile(absoluteFile, 'utf-8')
      } catch {
        originalContent = null
      }
    }
  }

  const fileChange: FileChange = {
    id: randomUUID(),
    sessionId: args.sessionId,
    attemptId: attempt.id,
    file: absoluteFile,
    operation: args.operation,
    content: args.content,
    originalContent,
    justification: args.justification.trim(),
    issueRefs: args.issueRefs ?? [],
  }

  const filteredChanges = attempt.fileChanges.filter(fc => fc.file !== absoluteFile)
  const updatedAttempt = { ...attempt, fileChanges: [...filteredChanges, fileChange] }

  const otherAttempts = exec.attempts.filter(a => a.id !== updatedAttempt.id)
  const updated = { ...exec, attempts: [...otherAttempts, updatedAttempt] }
  await ctx.store.save(updated, session)

  return {
    sessionId: args.sessionId,
    fileChangeId: fileChange.id,
    file: args.file,
    absolutePath: absoluteFile,
    operation: args.operation,
    attemptNumber: updatedAttempt.attemptNumber,
    totalChangesInAttempt: updatedAttempt.fileChanges.length,
    message: `File change queued (${args.operation}). Call upgrade_submit_file_change for more files or upgrade_apply_changes to write them all.`,
  }
}

export const submitFileChangeToolDefinition = {
  name: 'upgrade_submit_file_change',
  description:
    'Queue a file change (create, modify, or delete) for the in-place upgrade. ' +
    'Changes accumulate in the current attempt — call upgrade_apply_changes when all files are queued. ' +
    'Also used during CORRECTING to fix specific files after validation failure.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The execution session ID' },
      file: {
        type: 'string',
        description: 'File path (absolute or relative to projectPath)',
      },
      operation: {
        type: 'string',
        enum: ['create', 'modify', 'delete'],
        description: '"create" for new files, "modify" to update existing, "delete" to remove',
      },
      content: {
        type: 'string',
        description: 'Full new content of the file. Use empty string for delete operations.',
      },
      justification: {
        type: 'string',
        description: 'Why this change is needed and which issues it addresses',
      },
      issueRefs: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of issues this change resolves',
      },
    },
    required: ['sessionId', 'file', 'operation', 'content', 'justification'],
  },
}
