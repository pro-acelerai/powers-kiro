import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { assertInScope } from '../harness/scope.js'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { Attempt, Session } from '../domain/types.js'

function getCurrentAttempt(session: Session): Attempt {
  const inProgress = session.attempts.find(a => a.status === 'IN_PROGRESS')
  if (!inProgress) {
    throw new Error(
      `No IN_PROGRESS attempt found. ` +
      `Submit proposed changes first via submit_proposed_change.`
    )
  }
  return inProgress
}

export async function handleApplyChanges(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  // Harness enforces state: only APPROVED or CORRECTING can apply
  const allowedStates = ['APPROVED', 'CORRECTING'] as const
  if (!allowedStates.includes(session.status as typeof allowedStates[number])) {
    throw new Error(
      `apply_changes requires status APPROVED or CORRECTING, got ${session.status}. ` +
      `Get human approval first via request_human_approval.`
    )
  }

  const attempt = getCurrentAttempt(session)

  if (attempt.proposedChanges.length === 0) {
    throw new Error('No proposed changes found in the current attempt.')
  }

  // Control: revalidate scope for every change before touching any file.
  // Resolve relative paths against the workspace, not the server's cwd.
  for (const change of attempt.proposedChanges) {
    assertInScope(change.file, session.scope, ctx.workspacePath)
  }

  // Phase 1: snapshot every target file before touching any of them.
  // `originalContent` holds the real prior content (may be an empty string for a
  // genuinely empty file) or null when the file did not exist. We track existence
  // explicitly per change so rollback never has to infer intent from the backup value.
  const updatedChanges = [...attempt.proposedChanges]
  const existedBefore: boolean[] = new Array(updatedChanges.length).fill(false)
  for (let i = 0; i < updatedChanges.length; i++) {
    const change = updatedChanges[i]!
    let prior: string | null
    try {
      prior = await readFile(change.file, 'utf-8')
    } catch {
      prior = null // file does not exist
    }
    existedBefore[i] = prior !== null
    // Preserve any backup already captured in a prior apply of this attempt.
    if (change.originalContent === null) {
      updatedChanges[i] = { ...change, originalContent: prior }
    }
  }

  // Phase 2: write files; on failure, roll back every file already touched using
  // the recorded prior existence — created files are removed, pre-existing files
  // (including empty ones) are restored to their exact prior content.
  const appliedIndexes: number[] = []
  const appliedFiles: string[] = []
  try {
    for (let i = 0; i < updatedChanges.length; i++) {
      const change = updatedChanges[i]!
      if (change.operation === 'delete') {
        await unlink(change.file).catch(() => { /* already gone */ })
      } else {
        await mkdir(dirname(change.file), { recursive: true })
        await writeFile(change.file, change.content, 'utf-8')
      }
      appliedIndexes.push(i)
      appliedFiles.push(change.file)
    }
  } catch (err) {
    for (const i of appliedIndexes) {
      const change = updatedChanges[i]!
      if (existedBefore[i]) {
        // Restore prior content (originalContent is the real string, possibly '').
        const prior = change.originalContent ?? ''
        await writeFile(change.file, prior, 'utf-8').catch(() => {})
      } else {
        // File did not exist before this apply (create, or modify of a missing file).
        await unlink(change.file).catch(() => {})
      }
    }
    throw err
  }

  // Persist backup data collected in phase 1
  const updatedAttempt: Attempt = { ...attempt, proposedChanges: updatedChanges }
  const updatedAttempts = session.attempts.map(a =>
    a.id === updatedAttempt.id ? updatedAttempt : a
  )

  // Transition to APPLYING
  const transResult = transition(session, 'APPLYING')
  if (!transResult.ok) throw new Error(transResult.error)

  const updatedSession: Session = { ...transResult.session, attempts: updatedAttempts }
  await ctx.store.save(updatedSession, session)

  return {
    sessionId: session.id,
    status: 'APPLYING',
    appliedFiles,
    message: `Applied ${appliedFiles.length} file(s). Call run_lint to verify.`,
  }
}

export const applyChangesToolDefinition = {
  name: 'coding_apply_changes',
  description:
    'Apply the proposed changes to the workspace files. ' +
    'Requires human approval first. Validates scope before writing any file.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID' },
    },
    required: ['sessionId'],
  },
}
