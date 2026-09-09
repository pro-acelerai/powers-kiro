import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../trace/session-store.js'
import { handleRequestHumanApproval } from './request-human-approval.js'
import type { AppContext } from '../context.js'
import type { Session, Attempt } from '../domain/types.js'

describe('handleRequestHumanApproval()', () => {
  let tmpDir: string
  let ctx: AppContext

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pro-coding-rha-test-'))
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    ctx = { workspacePath: tmpDir, store: new SessionStore(tmpDir) }
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function buildProposedSession(): Promise<Session> {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })
    const attempt: Attempt = {
      id: 'attempt-1',
      sessionId: raw.id,
      attemptNumber: 1,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'IN_PROGRESS',
      proposedChanges: [
        {
          id: 'c1',
          attemptId: 'attempt-1',
          file: join(tmpDir, 'src', 'feature.ts'),
          operation: 'create',
          content: 'export {}',
          justification: 'test',
          originalContent: null,
        },
      ],
      verificationResult: null,
    }
    const proposed: Session = { ...raw, status: 'PROPOSED', attempts: [attempt] }
    await ctx.store.save(proposed)
    return proposed
  }

  it('transitions PROPOSED → APPROVED when human approves', async () => {
    const session = await buildProposedSession()

    const result = await handleRequestHumanApproval({ sessionId: session.id, approved: true }, ctx)

    assert.equal(result.status, 'APPROVED')

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.status, 'APPROVED')
    assert.ok(saved.humanDecision, 'humanDecision should be stored')
    assert.equal(saved.humanDecision!.approved, true)
  })

  it('transitions PROPOSED → REJECTED when human rejects', async () => {
    const session = await buildProposedSession()

    const result = await handleRequestHumanApproval(
      { sessionId: session.id, approved: false, notes: 'not what I wanted' },
      ctx
    )

    assert.equal(result.status, 'REJECTED')

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.status, 'REJECTED')
    assert.equal(saved.humanDecision!.approved, false)
    assert.equal(saved.humanDecision!.notes, 'not what I wanted')
  })

  it('stores notes from the human decision', async () => {
    const session = await buildProposedSession()

    await handleRequestHumanApproval(
      { sessionId: session.id, approved: true, notes: 'looks good, ship it' },
      ctx
    )

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.humanDecision!.notes, 'looks good, ship it')
  })

  it('rejects when session status is not PROPOSED', async () => {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })
    // CREATED state

    await assert.rejects(
      () => handleRequestHumanApproval({ sessionId: raw.id, approved: true }, ctx),
      /requires status PROPOSED/
    )
  })
})
