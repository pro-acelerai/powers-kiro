import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transition, canAttemptCorrection, currentAttemptNumber } from './state-machine.js'
import type {
  DiscoverySession,
  ArchitectureSession,
  ImplementationSession,
  DeliverySession,
  ImplementationAttempt,
} from './types.js'

// --- Test fixtures ---

function makeDiscovery(status: DiscoverySession['status'] = 'CREATED'): DiscoverySession {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    createdAt: '2024-01-01T00:00:00.000Z',
    type: 'discovery',
    status,
    artifactsPath: '/workspace',
    legacyPath: '/legacy',
    targetStack: 'Node.js',
    scope: ['/legacy/src'],
    findings: [],
    specification: null,
    humanDecision: null,
    thinkRecords: [],
    refinementBudget: 2,
    refinementCount: 0,
    resolution: null,
  }
}

function makeArchitecture(status: ArchitectureSession['status'] = 'CREATED'): ArchitectureSession {
  return {
    id: '00000000-0000-0000-0000-000000000002',
    createdAt: '2024-01-01T00:00:00.000Z',
    type: 'architecture',
    status,
    artifactsPath: '/workspace',
    discoverySessionId: '00000000-0000-0000-0000-000000000001',
    migrationPlan: null,
    humanDecision: null,
    thinkRecords: [],
    refinementBudget: 2,
    refinementCount: 0,
    resolution: null,
  }
}

function makeImplementation(
  status: ImplementationSession['status'] = 'CREATED',
  attempts: ImplementationAttempt[] = [],
  correctionBudget = 3,
): ImplementationSession {
  return {
    id: '00000000-0000-0000-0000-000000000003',
    createdAt: '2024-01-01T00:00:00.000Z',
    type: 'implementation',
    status,
    artifactsPath: '/workspace',
    discoverySessionId: '00000000-0000-0000-0000-000000000001',
    architectureSessionId: '00000000-0000-0000-0000-000000000002',
    phaseId: 'phase-1',
    phaseNumber: 1,
    phaseTitle: 'Domain',
    newProjectPath: '/workspace/new-app',
    correctionBudget,
    attempts,
    thinkRecords: [],
    resolution: null,
  }
}

function makeDelivery(status: DeliverySession['status'] = 'CREATED'): DeliverySession {
  return {
    id: '00000000-0000-0000-0000-000000000004',
    createdAt: '2024-01-01T00:00:00.000Z',
    type: 'delivery',
    status,
    artifactsPath: '/workspace',
    discoverySessionId: '00000000-0000-0000-0000-000000000001',
    architectureSessionId: '00000000-0000-0000-0000-000000000002',
    implementationSessionIds: ['00000000-0000-0000-0000-000000000003'],
    report: null,
    thinkRecords: [],
    resolution: null,
  }
}

function makeAttempt(id: string, status: ImplementationAttempt['status'] = 'COMPLETED'): ImplementationAttempt {
  return {
    id,
    sessionId: '00000000-0000-0000-0000-000000000003',
    attemptNumber: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    completedAt: status === 'COMPLETED' ? '2024-01-01T00:01:00.000Z' : null,
    status,
    newFiles: [],
    verificationResult: null,
  }
}

// --- Discovery transitions ---

test('discovery: CREATED → ANALYZING is allowed', () => {
  const result = transition(makeDiscovery('CREATED'), 'ANALYZING')
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.session.status, 'ANALYZING')
})

test('discovery: ANALYZING → TRIAGE_REVIEW and → SPECIFYING allowed', () => {
  assert.equal(transition(makeDiscovery('ANALYZING'), 'TRIAGE_REVIEW').ok, true)
  assert.equal(transition(makeDiscovery('ANALYZING'), 'SPECIFYING').ok, true)
})

test('discovery: SPEC_REVIEW can loop back to SPECIFYING or go DONE/REJECTED', () => {
  assert.equal(transition(makeDiscovery('SPEC_REVIEW'), 'SPECIFYING').ok, true)
  assert.equal(transition(makeDiscovery('SPEC_REVIEW'), 'DONE').ok, true)
  assert.equal(transition(makeDiscovery('SPEC_REVIEW'), 'REJECTED').ok, true)
})

test('discovery: CREATED → SPECIFYING is NOT allowed', () => {
  const result = transition(makeDiscovery('CREATED'), 'SPECIFYING')
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /Invalid transition \[discovery\]/)
})

test('discovery: DONE is terminal', () => {
  const result = transition(makeDiscovery('DONE'), 'ANALYZING')
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /terminal state/)
})

test('any session can transition to FAILED from non-terminal states', () => {
  assert.equal(transition(makeDiscovery('ANALYZING'), 'FAILED').ok, true)
  assert.equal(transition(makeArchitecture('PLANNING'), 'FAILED').ok, true)
  assert.equal(transition(makeImplementation('BUILDING'), 'FAILED').ok, true)
  assert.equal(transition(makeDelivery('REPORTING'), 'FAILED').ok, true)
})

// --- Architecture transitions ---

test('architecture: happy path CREATED → PLANNING → PLAN_REVIEW → DONE', () => {
  assert.equal(transition(makeArchitecture('CREATED'), 'PLANNING').ok, true)
  assert.equal(transition(makeArchitecture('PLANNING'), 'PLAN_REVIEW').ok, true)
  assert.equal(transition(makeArchitecture('PLAN_REVIEW'), 'DONE').ok, true)
})

test('architecture: PLAN_REVIEW can loop back to PLANNING', () => {
  assert.equal(transition(makeArchitecture('PLAN_REVIEW'), 'PLANNING').ok, true)
})

test('architecture: CREATED → DONE is NOT allowed', () => {
  assert.equal(transition(makeArchitecture('CREATED'), 'DONE').ok, false)
})

// --- Implementation transitions ---

test('implementation: full loop CREATED → BUILDING → APPLYING → VALIDATING', () => {
  assert.equal(transition(makeImplementation('CREATED'), 'BUILDING').ok, true)
  assert.equal(transition(makeImplementation('BUILDING'), 'APPLYING').ok, true)
  assert.equal(transition(makeImplementation('APPLYING'), 'VALIDATING').ok, true)
})

test('implementation: VALIDATING → DONE / CORRECTING / BUDGET_EXCEEDED allowed', () => {
  assert.equal(transition(makeImplementation('VALIDATING'), 'DONE').ok, true)
  assert.equal(transition(makeImplementation('VALIDATING'), 'CORRECTING').ok, true)
  assert.equal(transition(makeImplementation('VALIDATING'), 'BUDGET_EXCEEDED').ok, true)
})

test('implementation: CORRECTING → APPLYING allowed (correction loop)', () => {
  assert.equal(transition(makeImplementation('CORRECTING'), 'APPLYING').ok, true)
})

test('implementation: BUDGET_EXCEEDED is terminal', () => {
  assert.equal(transition(makeImplementation('BUDGET_EXCEEDED'), 'APPLYING').ok, false)
})

// --- Delivery transitions ---

test('delivery: CREATED → REPORTING → DONE', () => {
  assert.equal(transition(makeDelivery('CREATED'), 'REPORTING').ok, true)
  assert.equal(transition(makeDelivery('REPORTING'), 'DONE').ok, true)
})

test('delivery: CREATED → DONE is NOT allowed', () => {
  assert.equal(transition(makeDelivery('CREATED'), 'DONE').ok, false)
})

// --- transition immutability ---

test('transition does not mutate the original session', () => {
  const session = makeDiscovery('CREATED')
  transition(session, 'ANALYZING')
  assert.equal(session.status, 'CREATED')
})

// --- Correction budget helpers ---

test('canAttemptCorrection: true when attempts below budget', () => {
  const session = makeImplementation('CREATED', [makeAttempt('a1')], 3)
  assert.equal(canAttemptCorrection(session), true)
})

test('canAttemptCorrection: false when attempts reach budget', () => {
  const session = makeImplementation('CREATED', [makeAttempt('a1'), makeAttempt('a2'), makeAttempt('a3')], 3)
  assert.equal(canAttemptCorrection(session), false)
})

test('currentAttemptNumber: attempts length + 1', () => {
  assert.equal(currentAttemptNumber(makeImplementation('CREATED', [])), 1)
  assert.equal(currentAttemptNumber(makeImplementation('CREATED', [makeAttempt('a1'), makeAttempt('a2')])), 3)
})
