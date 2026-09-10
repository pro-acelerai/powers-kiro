import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore, CORRECTION_BUDGET, REFINEMENT_BUDGET } from './session-store.js'
import type { ImplementationSession, ImplementationAttempt } from '../domain/types.js'

let workspace: string
let store: SessionStore

before(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'modernization-test-'))
  store = new SessionStore(workspace)
})

after(async () => {
  await rm(workspace, { recursive: true, force: true })
})

// --- Session creation ---

test('createDiscovery: creates a CREATED discovery session with budgets', async () => {
  const session = await store.createDiscovery({
    legacyPath: '/legacy',
    targetStack: 'Node.js',
    scope: ['/legacy/src'],
  })
  assert.equal(session.type, 'discovery')
  assert.equal(session.status, 'CREATED')
  assert.equal(session.refinementBudget, REFINEMENT_BUDGET)
  assert.equal(session.refinementCount, 0)
  assert.match(session.id, /^[0-9a-f-]{36}$/i)
})

test('createArchitecture / createImplementation / createDelivery set correct defaults', async () => {
  const arch = await store.createArchitecture({ discoverySessionId: 'disc-1' })
  assert.equal(arch.type, 'architecture')
  assert.equal(arch.refinementBudget, REFINEMENT_BUDGET)

  const impl = await store.createImplementation({
    discoverySessionId: 'disc-1',
    architectureSessionId: 'arch-1',
    phaseId: 'phase-1',
    phaseNumber: 1,
    phaseTitle: 'Domain',
    newProjectPath: join(workspace, 'new-app'),
  })
  assert.equal(impl.type, 'implementation')
  assert.equal(impl.status, 'CREATED')
  assert.equal(impl.correctionBudget, CORRECTION_BUDGET)
  assert.deepEqual(impl.attempts, [])

  const deliv = await store.createDelivery({
    discoverySessionId: 'disc-1',
    architectureSessionId: 'arch-1',
    implementationSessionIds: [impl.id],
  })
  assert.equal(deliv.type, 'delivery')
  assert.equal(deliv.report, null)
})

// --- Persistence round-trip ---

test('load: returns the persisted session', async () => {
  const created = await store.createDiscovery({
    legacyPath: '/legacy',
    targetStack: 'Go',
    scope: ['/legacy'],
  })
  const loaded = await store.load(created.id)
  assert.deepEqual(loaded, created)
})

test('load: throws a clear error for a missing session', async () => {
  await assert.rejects(
    () => store.load('99999999-9999-9999-9999-999999999999'),
    /Session not found/,
  )
})

test('load: rejects malformed session IDs', async () => {
  await assert.rejects(() => store.load('not-a-uuid'), /Invalid session ID format/)
})

// --- Invariants on save ---

test('save: rejects changing the session type', async () => {
  const disc = await store.createDiscovery({ legacyPath: '/l', targetStack: 's', scope: ['/l'] })
  const tampered = { ...disc, type: 'architecture' } as unknown as typeof disc
  await assert.rejects(() => store.save(tampered, disc), /session type is immutable/)
})

test('save: rejects changing the correction budget', async () => {
  const impl = await store.createImplementation({
    discoverySessionId: 'd', architectureSessionId: 'a',
    phaseId: 'p', phaseNumber: 1, phaseTitle: 'T', newProjectPath: join(workspace, 'app'),
  })
  const tampered: ImplementationSession = { ...impl, correctionBudget: 99 }
  await assert.rejects(() => store.save(tampered, impl), /correctionBudget is immutable/)
})

test('save: rejects removing a completed attempt', async () => {
  const impl = await store.createImplementation({
    discoverySessionId: 'd', architectureSessionId: 'a',
    phaseId: 'p', phaseNumber: 1, phaseTitle: 'T', newProjectPath: join(workspace, 'app'),
  })
  const completed: ImplementationAttempt = {
    id: 'attempt-1', sessionId: impl.id, attemptNumber: 1,
    createdAt: '2024-01-01T00:00:00.000Z', completedAt: '2024-01-01T00:01:00.000Z',
    status: 'COMPLETED', newFiles: [], verificationResult: null,
  }
  const withAttempt: ImplementationSession = { ...impl, attempts: [completed] }
  await store.save(withAttempt, impl)

  const removed: ImplementationSession = { ...withAttempt, attempts: [] }
  await assert.rejects(() => store.save(removed, withAttempt), /completed attempt attempt-1 was removed/)
})

test('save: rejects modifying a completed attempt', async () => {
  const impl = await store.createImplementation({
    discoverySessionId: 'd', architectureSessionId: 'a',
    phaseId: 'p', phaseNumber: 1, phaseTitle: 'T', newProjectPath: join(workspace, 'app'),
  })
  const completed: ImplementationAttempt = {
    id: 'attempt-1', sessionId: impl.id, attemptNumber: 1,
    createdAt: '2024-01-01T00:00:00.000Z', completedAt: '2024-01-01T00:01:00.000Z',
    status: 'COMPLETED', newFiles: [], verificationResult: null,
  }
  const withAttempt: ImplementationSession = { ...impl, attempts: [completed] }
  await store.save(withAttempt, impl)

  const modified: ImplementationSession = {
    ...withAttempt,
    attempts: [{ ...completed, attemptNumber: 42 }],
  }
  await assert.rejects(() => store.save(modified, withAttempt), /completed attempt attempt-1 was modified/)
})

test('save: allows appending a new attempt and updating status', async () => {
  const impl = await store.createImplementation({
    discoverySessionId: 'd', architectureSessionId: 'a',
    phaseId: 'p', phaseNumber: 1, phaseTitle: 'T', newProjectPath: join(workspace, 'app'),
  })
  const inProgress: ImplementationAttempt = {
    id: 'attempt-1', sessionId: impl.id, attemptNumber: 1,
    createdAt: '2024-01-01T00:00:00.000Z', completedAt: null,
    status: 'IN_PROGRESS', newFiles: [], verificationResult: null,
  }
  const next: ImplementationSession = { ...impl, status: 'BUILDING', attempts: [inProgress] }
  await assert.doesNotReject(() => store.save(next, impl))

  const reloaded = await store.load(impl.id)
  assert.equal(reloaded.status, 'BUILDING')
})

// --- Report ---

test('saveReport: writes the report markdown to the trace dir', async () => {
  const deliv = await store.createDelivery({
    discoverySessionId: 'd', architectureSessionId: 'a', implementationSessionIds: ['i'],
  })
  await store.saveReport(deliv.id, '# Migration Report\n\nAll good.')
  const reportPath = join(workspace, '.kiro', 'trace', 'modernization', `report-${deliv.id}.md`)
  const content = await readFile(reportPath, 'utf-8')
  assert.match(content, /# Migration Report/)
})
