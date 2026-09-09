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

  // Control: revalidate scope for every change before touching any file
  for (const change of attempt.proposedChanges) {
    assertInScope(change.file, session.scope)
  }

  // Phase 1: collect all original content before touching any file
  const updatedChanges = [...attempt.proposedChanges]
  for (let i = 0; i < updatedChanges.length; i++) {
    const change = updatedChanges[i]!
    if (change.originalContent === null && change.operation !== 'create') {
      try {
        updatedChanges[i] = { ...change, originalContent: await readFile(change.file, 'utf-8') }
      } catch {
        updatedChanges[i] = { ...change, originalContent: '' }
      }
    }
  }

  // Phase 2: write files; on failure, restore already-written files
  const appliedFiles: string[] = []
  try {
    for (const change of updatedChanges) {
      if (change.operation === 'delete') {
        await unlink(change.file).catch(() => { /* already gone */ })
      } else {
        await mkdir(dirname(change.file), { recursive: true })
        await writeFile(change.file, change.content, 'utf-8')
      }
      appliedFiles.push(change.file)
    }
  } catch (err) {
    for (const change of updatedChanges) {
      if (!appliedFiles.includes(change.file)) continue
      if (change.operation === 'delete') continue
      if (change.originalContent === '') {
        await unlink(change.file).catch(() => {})
      } else if (change.originalContent !== null) {
        await writeFile(change.file, change.originalContent, 'utf-8').catch(() => {})
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
  name: 'pro-coding_apply_changes',
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
