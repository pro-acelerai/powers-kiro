import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from './session-store.js'
import type { Session, Attempt } from '../domain/types.js'

function makeCompletedAttempt(sessionId: string, n: number): Attempt {
  return {
    id: `attempt-${n}`,
    sessionId,
    attemptNumber: n,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z',
    status: 'COMPLETED',
    proposedChanges: [],
    verificationResult: null,
  }
}

describe('SessionStore', () => {
  let tmpDir: string
  let store: SessionStore

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'coding-test-'))
    store = new SessionStore(tmpDir)
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates a session with correctionBudget fixed at 3', async () => {
    const session = await store.create({ userStory: 'As a user...', scope: ['/src'] })
    assert.equal(session.correctionBudget, 3)
    assert.equal(session.status, 'CREATED')
    assert.ok(session.id)
  })

  it('persists and reloads a session correctly', async () => {
    const created = await store.create({ userStory: 'story', scope: ['/src'] })
    const loaded = await store.load(created.id)
    assert.deepEqual(loaded, created)
  })

  it('throws when loading a non-existent session', async () => {
    await assert.rejects(
      () => store.load('non-existent-id'),
      /Session not found/
    )
  })

  it('atomic write: leaves no .tmp files behind after a successful save', async () => {
    const session = await store.create({ userStory: 'atomic', scope: ['/src'] })
    await store.save({ ...session, status: 'READING' }, session)

    const traceDir = join(tmpDir, '.kiro', 'trace')
    const entries = await readdir(traceDir)
    const leftovers = entries.filter(e => e.endsWith('.tmp'))
    assert.deepEqual(leftovers, [], 'no temp files should remain after save')
    // Final file is present and parseable.
    const reloaded = await store.load(session.id)
    assert.equal(reloaded.status, 'READING')
  })

  // Invariant 1.4
  it('Invariant 1.4: rejects modification of correctionBudget', async () => {
    const session = await store.create({ userStory: 'test', scope: ['/src'] })
    const tampered: Session = { ...session, correctionBudget: 99 }

    await assert.rejects(
      () => store.save(tampered, session),
      /correctionBudget is immutable/
    )
  })

  it('Invariant 1.4: save without previous does not enforce budget (first write)', async () => {
    const session = await store.create({ userStory: 'test', scope: ['/src'] })
    // No previous — should succeed (this is the create path)
    const updated: Session = { ...session, status: 'READING' }
    await assert.doesNotReject(() => store.save(updated))
  })

  // Invariant 1.5
  it('Invariant 1.5: rejects removal of a completed attempt', async () => {
    const session = await store.create({ userStory: 'test', scope: ['/src'] })
    const withAttempt: Session = {
      ...session,
      attempts: [makeCompletedAttempt(session.id, 1)],
    }
    await store.save(withAttempt, session)

    const withoutAttempt: Session = { ...withAttempt, attempts: [] }

    await assert.rejects(
      () => store.save(withoutAttempt, withAttempt),
      /completed attempt.*was removed/
    )
  })

  it('Invariant 1.5: rejects modification of a completed attempt', async () => {
    const session = await store.create({ userStory: 'test', scope: ['/src'] })
    const withAttempt: Session = {
      ...session,
      attempts: [makeCompletedAttempt(session.id, 1)],
    }
    await store.save(withAttempt, session)

    const tampered: Session = {
      ...withAttempt,
      attempts: [{
        ...withAttempt.attempts[0],
        completedAt: '2099-01-01T00:00:00.000Z',  // modified field
      }],
    }

    await assert.rejects(
      () => store.save(tampered, withAttempt),
      /completed attempt.*was modified/
    )
  })

  it('Invariant 1.5: allows modifying an IN_PROGRESS attempt', async () => {
    const session = await store.create({ userStory: 'test', scope: ['/src'] })
    const withAttempt: Session = {
      ...session,
      attempts: [{
        id: 'attempt-1',
        sessionId: session.id,
        attemptNumber: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        completedAt: null,
        status: 'IN_PROGRESS',
        proposedChanges: [],
        verificationResult: null,
      }],
    }
    await store.save(withAttempt, session)

    const updated: Session = {
      ...withAttempt,
      attempts: [{
        ...withAttempt.attempts[0],
        completedAt: new Date().toISOString(),
        status: 'COMPLETED',
      }],
    }

    await assert.doesNotReject(() => store.save(updated, withAttempt))
  })
})
