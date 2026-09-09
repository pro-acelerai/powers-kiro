import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../trace/session-store.js'
import { handleSubmitCorrection } from './submit-correction.js'
import type { AppContext } from '../context.js'
import type { Session, Attempt } from '../domain/types.js'

describe('handleSubmitCorrection()', () => {
  let tmpDir: string
  let ctx: AppContext

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pro-coding-sc-test-'))
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    ctx = { workspacePath: tmpDir, store: new SessionStore(tmpDir) }
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function buildCorrectingSession(): Promise<Session> {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })
    // One completed failed attempt
    const completedAttempt: Attempt = {
      id: 'attempt-1',
      sessionId: raw.id,
      attemptNumber: 1,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 'COMPLETED',
      proposedChanges: [],
      verificationResult: {
        id: 'vr-1',
        attemptId: 'attempt-1',
        createdAt: new Date().toISOString(),
        type: 'lint',
        status: 'FAIL',
        rawOutput: '[]',
        failureEvidence: [],
      },
    }
    const correcting: Session = {
      ...raw,
      status: 'CORRECTING',
      attempts: [completedAttempt],
    }
    await ctx.store.save(correcting)
    return correcting
  }

  it('creates a new IN_PROGRESS attempt on first call', async () => {
    const session = await buildCorrectingSession()
    const targetFile = join(tmpDir, 'src', 'fixed.js')

    const result = await handleSubmitCorrection(
      { sessionId: session.id, file: targetFile, operation: 'modify', content: 'const fixed = 1;', justification: 'fix lint error' },
      ctx
    )

    assert.equal(result.status, 'CORRECTING')
    assert.equal(result.totalChanges, 1)
    assert.equal(result.attemptNumber, 2)

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.attempts.length, 2)
    assert.equal(saved.attempts[1]!.status, 'IN_PROGRESS')
    assert.equal(saved.attempts[1]!.proposedChanges.length, 1)
    assert.equal(saved.attempts[1]!.proposedChanges[0]!.file, targetFile)
  })

  it('accumulates changes in the same new attempt on multiple calls', async () => {
    const session = await buildCorrectingSession()
    const file1 = join(tmpDir, 'src', 'fix-a.js')
    const file2 = join(tmpDir, 'src', 'fix-b.js')

    await handleSubmitCorrection(
      { sessionId: session.id, file: file1, operation: 'modify', content: 'const a = 1;', justification: 'fix a' },
      ctx
    )
    const result = await handleSubmitCorrection(
      { sessionId: session.id, file: file2, operation: 'modify', content: 'const b = 2;', justification: 'fix b' },
      ctx
    )

    assert.equal(result.totalChanges, 2)

    const saved = await ctx.store.load(session.id)
    // Still only 2 attempts total (1 completed + 1 new IN_PROGRESS)
    assert.equal(saved.attempts.length, 2)
    assert.equal(saved.attempts[1]!.proposedChanges.length, 2)
  })

  it('rejects file outside scope', async () => {
    const session = await buildCorrectingSession()
    const outsideFile = join(tmpDir, 'outside', 'hack.js')

    await assert.rejects(
      () =>
        handleSubmitCorrection(
          { sessionId: session.id, file: outsideFile, operation: 'modify', content: '', justification: 'bad' },
          ctx
        ),
      /Scope violation/
    )
  })

  it('rejects when session is not CORRECTING', async () => {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })

    await assert.rejects(
      () =>
        handleSubmitCorrection(
          { sessionId: raw.id, file: join(tmpDir, 'src', 'x.js'), operation: 'modify', content: '', justification: 'x' },
          ctx
        ),
      /requires status CORRECTING/
    )
  })
})
