import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { transition, canAttemptCorrection } from './state-machine.js'
import type { Session, Attempt } from './types.js'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    createdAt: '2026-01-01T00:00:00.000Z',
    userStory: 'As a user I want...',
    scope: ['/workspace/src'],
    correctionBudget: 3,
    status: 'CREATED',
    plan: null,
    humanDecision: null,
    attempts: [],
    resolution: null,
    ...overrides,
  }
}

function makeCompletedAttempt(n: number): Attempt {
  return {
    id: `attempt-${n}`,
    sessionId: 'test-id',
    attemptNumber: n,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z',
    status: 'COMPLETED',
    proposedChanges: [],
    verificationResult: null,
  }
}

describe('transition()', () => {
  it('CREATED → READING is valid', () => {
    const result = transition(makeSession({ status: 'CREATED' }), 'READING')
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.session.status, 'READING')
  })

  it('READING → PLANNING is valid', () => {
    const result = transition(makeSession({ status: 'READING' }), 'PLANNING')
    assert.equal(result.ok, true)
  })

  it('PLANNING → PROPOSED is valid', () => {
    const result = transition(makeSession({ status: 'PLANNING' }), 'PROPOSED')
    assert.equal(result.ok, true)
  })

  it('PROPOSED → APPROVED is valid', () => {
    const result = transition(makeSession({ status: 'PROPOSED' }), 'APPROVED')
    assert.equal(result.ok, true)
  })

  it('PROPOSED → REJECTED is valid', () => {
    const result = transition(makeSession({ status: 'PROPOSED' }), 'REJECTED')
    assert.equal(result.ok, true)
  })

  it('APPROVED → APPLYING is valid', () => {
    const result = transition(makeSession({ status: 'APPROVED' }), 'APPLYING')
    assert.equal(result.ok, true)
  })

  it('APPLYING → VERIFYING is valid', () => {
    const result = transition(makeSession({ status: 'APPLYING' }), 'VERIFYING')
    assert.equal(result.ok, true)
  })

  it('VERIFYING → DONE is valid', () => {
    const result = transition(makeSession({ status: 'VERIFYING' }), 'DONE')
    assert.equal(result.ok, true)
  })

  it('VERIFYING → CORRECTING is valid', () => {
    const result = transition(makeSession({ status: 'VERIFYING' }), 'CORRECTING')
    assert.equal(result.ok, true)
  })

  it('VERIFYING → BUDGET_EXCEEDED is valid', () => {
    const result = transition(makeSession({ status: 'VERIFYING' }), 'BUDGET_EXCEEDED')
    assert.equal(result.ok, true)
  })

  it('CORRECTING → APPLYING is valid', () => {
    const result = transition(makeSession({ status: 'CORRECTING' }), 'APPLYING')
    assert.equal(result.ok, true)
  })

  it('CREATED → APPLYING is invalid', () => {
    const result = transition(makeSession({ status: 'CREATED' }), 'APPLYING')
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /CREATED → APPLYING/)
  })

  it('DONE is a terminal state — rejects all transitions', () => {
    for (const target of ['READING', 'APPLYING', 'PROPOSED', 'CORRECTING'] as const) {
      const result = transition(makeSession({ status: 'DONE' }), target)
      assert.equal(result.ok, false, `Expected DONE → ${target} to be rejected`)
    }
  })

  it('REJECTED is a terminal state — rejects all transitions', () => {
    const result = transition(makeSession({ status: 'REJECTED' }), 'APPROVED')
    assert.equal(result.ok, false)
  })

  it('BUDGET_EXCEEDED is a terminal state — rejects all transitions', () => {
    const result = transition(makeSession({ status: 'BUDGET_EXCEEDED' }), 'CORRECTING')
    assert.equal(result.ok, false)
  })

  it('does not mutate the original session', () => {
    const original = makeSession({ status: 'CREATED' })
    const result = transition(original, 'READING')
    assert.equal(original.status, 'CREATED')
    if (result.ok) assert.equal(result.session.status, 'READING')
  })
})

describe('canAttemptCorrection()', () => {
  it('returns true when no attempts made', () => {
    assert.equal(canAttemptCorrection(makeSession()), true)
  })

  it('returns true when attempts < budget', () => {
    const session = makeSession({ attempts: [makeCompletedAttempt(1), makeCompletedAttempt(2)] })
    assert.equal(canAttemptCorrection(session), true)
  })

  it('returns false when attempts === budget', () => {
    const session = makeSession({
      attempts: [makeCompletedAttempt(1), makeCompletedAttempt(2), makeCompletedAttempt(3)],
    })
    assert.equal(canAttemptCorrection(session), false)
  })
})
