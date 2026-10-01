import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../trace/session-store.js'
import { handleApplyChanges } from './apply-changes.js'
import type { AppContext } from '../context.js'
import type { Session, Attempt, ProposedChange } from '../domain/types.js'

function makeAttempt(sessionId: string, changes: ProposedChange[]): Attempt {
  return {
    id: 'attempt-1',
    sessionId,
    attemptNumber: 1,
    createdAt: new Date().toISOString(),
    completedAt: null,
    status: 'IN_PROGRESS',
    proposedChanges: changes,
    verificationResult: null,
  }
}

describe('handleApplyChanges()', () => {
  let tmpDir: string
  let ctx: AppContext

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'coding-apply-test-'))
    ctx = {
      workspacePath: tmpDir,
      store: new SessionStore(tmpDir),
    }
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function buildApprovedSession(changes: ProposedChange[]): Promise<Session> {
    const raw = await ctx.store.create({
      userStory: 'test',
      scope: [join(tmpDir, 'src')],
    })
    const withAttempt: Session = {
      ...raw,
      status: 'APPROVED',
      attempts: [makeAttempt(raw.id, changes)],
    }
    await ctx.store.save(withAttempt)
    return withAttempt
  }

  it('writes a file that is within scope', async () => {
    const srcDir = join(tmpDir, 'src')
    await mkdir(srcDir, { recursive: true })
    const targetFile = join(srcDir, 'hello.ts')

    const change: ProposedChange = {
      id: 'c1',
      attemptId: 'attempt-1',
      file: targetFile,
      operation: 'create',
      content: 'export const hello = "world"',
      justification: 'test',
      originalContent: null,
    }

    const session = await buildApprovedSession([change])
    const result = await handleApplyChanges({ sessionId: session.id }, ctx)

    assert.equal(result.status, 'APPLYING')
    assert.deepEqual(result.appliedFiles, [targetFile])

    const written = await readFile(targetFile, 'utf-8')
    assert.equal(written, 'export const hello = "world"')
  })

  it('saves originalContent backup before overwriting an existing file', async () => {
    const srcDir = join(tmpDir, 'src', 'sub2')
    await mkdir(srcDir, { recursive: true })
    const targetFile = join(srcDir, 'existing.ts')
    await writeFile(targetFile, 'original content', 'utf-8')

    const change: ProposedChange = {
      id: 'c2',
      attemptId: 'attempt-1',
      file: targetFile,
      operation: 'modify',
      content: 'new content',
      justification: 'test',
      originalContent: null,
    }

    const session = await buildApprovedSession([change])
    await handleApplyChanges({ sessionId: session.id }, ctx)

    // Verify backup was persisted in the session trace
    const saved = await ctx.store.load(session.id)
    const savedChange = saved.attempts[0]!.proposedChanges[0]!
    assert.equal(savedChange.originalContent, 'original content')
  })

  it('rejects a file outside scope with a clear error', async () => {
    const outsideFile = join(tmpDir, 'outside', 'secret.ts')
    await mkdir(join(tmpDir, 'outside'), { recursive: true })

    const change: ProposedChange = {
      id: 'c3',
      attemptId: 'attempt-1',
      file: outsideFile,
      operation: 'create',
      content: 'hacked',
      justification: 'test',
      originalContent: null,
    }

    const session = await buildApprovedSession([change])

    await assert.rejects(
      () => handleApplyChanges({ sessionId: session.id }, ctx),
      /Scope violation/
    )

    // File must not have been written
    const exists = await readFile(outsideFile, 'utf-8').catch(() => null)
    assert.equal(exists, null)
  })

  it('rejects apply when session is not APPROVED', async () => {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })
    // Status is CREATED, not APPROVED

    await assert.rejects(
      () => handleApplyChanges({ sessionId: raw.id }, ctx),
      /requires status APPROVED or CORRECTING/
    )
  })

  it('rejects apply when there are no proposed changes', async () => {
    const session = await buildApprovedSession([])

    await assert.rejects(
      () => handleApplyChanges({ sessionId: session.id }, ctx),
      /No proposed changes/
    )
  })

  it('rollback removes a created file when a later change fails', async () => {
    const srcDir = join(tmpDir, 'src', 'rb-create')
    await mkdir(srcDir, { recursive: true })
    const createdFile = join(srcDir, 'created.ts')
    // A file used as a directory component makes mkdir/writeFile of its "child" fail.
    const blocker = join(srcDir, 'blocker')
    await writeFile(blocker, 'i am a file', 'utf-8')
    const failingFile = join(blocker, 'child.ts') // parent is a file → write fails

    const changes: ProposedChange[] = [
      {
        id: 'ok', attemptId: 'attempt-1', file: createdFile,
        operation: 'create', content: 'export const x = 1',
        justification: 'first', originalContent: null,
      },
      {
        id: 'boom', attemptId: 'attempt-1', file: failingFile,
        operation: 'create', content: 'never written',
        justification: 'second', originalContent: null,
      },
    ]

    const session = await buildApprovedSession(changes)

    await assert.rejects(() => handleApplyChanges({ sessionId: session.id }, ctx))

    // The successfully-created file must have been rolled back (deleted).
    const stillThere = await readFile(createdFile, 'utf-8').catch(() => null)
    assert.equal(stillThere, null, 'created file should be removed on rollback')
  })

  it('rollback restores a pre-existing EMPTY file instead of deleting it', async () => {
    const srcDir = join(tmpDir, 'src', 'rb-empty')
    await mkdir(srcDir, { recursive: true })
    const emptyFile = join(srcDir, 'empty.ts')
    await writeFile(emptyFile, '', 'utf-8') // genuinely empty, but exists
    const blocker = join(srcDir, 'blocker')
    await writeFile(blocker, 'i am a file', 'utf-8')
    const failingFile = join(blocker, 'child.ts')

    const changes: ProposedChange[] = [
      {
        id: 'mod', attemptId: 'attempt-1', file: emptyFile,
        operation: 'modify', content: 'overwritten',
        justification: 'first', originalContent: null,
      },
      {
        id: 'boom', attemptId: 'attempt-1', file: failingFile,
        operation: 'create', content: 'never',
        justification: 'second', originalContent: null,
      },
    ]

    const session = await buildApprovedSession(changes)

    await assert.rejects(() => handleApplyChanges({ sessionId: session.id }, ctx))

    // The empty file must still exist and be empty — not deleted.
    const restored = await readFile(emptyFile, 'utf-8').catch(() => null)
    assert.equal(restored, '', 'pre-existing empty file must be restored, not deleted')
  })
})
