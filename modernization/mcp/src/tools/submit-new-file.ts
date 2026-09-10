import { randomUUID } from 'node:crypto'
import { resolve, sep } from 'node:path'
import type { AppContext } from '../context.js'
import type { ImplementationSession, NewFile, FileOperation } from '../domain/types.js'
import { getCurrentAttempt } from './attempt-utils.js'

interface SubmitNewFileArgs {
  sessionId: string
  file: string
  operation: FileOperation
  content: string
  justification: string
  specRefs?: string[]
}

export async function handleSubmitNewFile(args: SubmitNewFileArgs, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'implementation') {
    throw new Error(`submit_new_file requires an implementation session, got ${session.type}`)
  }

  const allowedStatuses = ['BUILDING', 'CORRECTING'] as const
  if (!allowedStatuses.includes(session.status as typeof allowedStatuses[number])) {
    throw new Error(`submit_new_file requires status BUILDING or CORRECTING, got ${session.status}`)
  }

  if (!args.file?.trim()) throw new Error('file path is required')
  if (args.content === undefined || args.content === null) throw new Error('content is required (use empty string for empty files)')
  if (!args.justification?.trim()) throw new Error('justification is required')

  const validOperations: FileOperation[] = ['create', 'modify']
  if (!validOperations.includes(args.operation)) {
    throw new Error(`operation must be one of: ${validOperations.join(', ')}`)
  }

  const impl = session as ImplementationSession
  let attempt = getCurrentAttempt(impl)

  if (!attempt) {
    if (session.status === 'CORRECTING') {
      // In CORRECTING state, submit_correction must be called first to create the attempt
      throw new Error(
        'No IN_PROGRESS attempt found. In CORRECTING state, call submit_correction first to authorize and start a new attempt.'
      )
    }
    // BUILDING: create the first attempt lazily
    attempt = {
      id: randomUUID(),
      sessionId: args.sessionId,
      attemptNumber: impl.attempts.length + 1,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'IN_PROGRESS' as const,
      newFiles: [],
      verificationResult: null,
    }
  }

  const absoluteFile = resolve(impl.newProjectPath, args.file.trim())

  // Critical: prevent path traversal — file must be strictly inside the new project directory
  const projectBase = impl.newProjectPath.endsWith(sep) ? impl.newProjectPath : impl.newProjectPath + sep
  if (!absoluteFile.startsWith(projectBase)) {
    throw new Error(
      `Path traversal detected: "${args.file}" resolves to "${absoluteFile}", ` +
      `which is outside the new project directory "${impl.newProjectPath}". ` +
      `Use paths relative to the project root (e.g. "src/domain/user.ts").`
    )
  }

  const newFile: NewFile = {
    id: randomUUID(),
    sessionId: args.sessionId,
    attemptId: attempt.id,
    file: absoluteFile,
    operation: args.operation,
    content: args.content,
    justification: args.justification.trim(),
    specRefs: args.specRefs ?? [],
  }

  // Remove existing entry for same file in this attempt (correction overwrites)
  const filteredFiles = attempt.newFiles.filter(f => f.file !== absoluteFile)
  const updatedAttempt = { ...attempt, newFiles: [...filteredFiles, newFile] }

  const otherAttempts = impl.attempts.filter(a => a.id !== updatedAttempt.id)
  const updated = { ...impl, attempts: [...otherAttempts, updatedAttempt] }
  await ctx.store.save(updated, session)

  return {
    sessionId: args.sessionId,
    fileId: newFile.id,
    file: args.file,
    absolutePath: absoluteFile,
    operation: args.operation,
    attemptNumber: updatedAttempt.attemptNumber,
    totalFilesInAttempt: updatedAttempt.newFiles.length,
    message: `File queued (${args.operation}). Call submit_new_file for more files or apply_new_project to write them all.`,
  }
}

export const submitNewFileToolDefinition = {
  name: 'modernization_submit_new_file',
  description:
    'Queue a file to be created or modified in the new project. ' +
    'Files are relative to the new project root. ' +
    'Accumulates files in the current attempt — call apply_new_project when all files are queued. ' +
    'Also used during CORRECTING to overwrite specific files with fixes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The implementation session ID' },
      file: { type: 'string', description: 'File path relative to new project root (e.g. "src/domain/user.ts")' },
      operation: {
        type: 'string',
        enum: ['create', 'modify'],
        description: '"create" for new files, "modify" to overwrite an existing one during correction',
      },
      content: { type: 'string', description: 'Full content of the file' },
      justification: { type: 'string', description: 'Why this file is needed and what spec items it implements' },
      specRefs: {
        type: 'array',
        items: { type: 'string' },
        description: 'References to spec items this file implements (e.g. spec rule IDs, entity names, flow IDs)',
      },
    },
    required: ['sessionId', 'file', 'operation', 'content', 'justification'],
  },
}
