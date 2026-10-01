import type {
  Session,
  SessionStatus,
  DiscoveryStatus,
  ArchitectureStatus,
  ImplementationStatus,
  DeliveryStatus,
  ImplementationSession,
} from './types.js'

const DISCOVERY_TRANSITIONS: Record<DiscoveryStatus, DiscoveryStatus[]> = {
  CREATED:       ['ANALYZING', 'FAILED'],
  ANALYZING:     ['TRIAGE_REVIEW', 'SPECIFYING', 'FAILED'],
  TRIAGE_REVIEW: ['SPECIFYING', 'FAILED'],
  SPECIFYING:    ['SPEC_REVIEW', 'FAILED'],
  SPEC_REVIEW:   ['DONE', 'SPECIFYING', 'REJECTED', 'FAILED'],
  DONE:          [],
  REJECTED:      [],
  FAILED:        [],
}

const ARCHITECTURE_TRANSITIONS: Record<ArchitectureStatus, ArchitectureStatus[]> = {
  CREATED:     ['PLANNING', 'FAILED'],
  PLANNING:    ['PLAN_REVIEW', 'FAILED'],
  PLAN_REVIEW: ['DONE', 'PLANNING', 'REJECTED', 'FAILED'],
  DONE:        [],
  REJECTED:    [],
  FAILED:      [],
}

const IMPLEMENTATION_TRANSITIONS: Record<ImplementationStatus, ImplementationStatus[]> = {
  CREATED:         ['BUILDING', 'FAILED'],
  BUILDING:        ['APPLYING', 'FAILED'],
  APPLYING:        ['VALIDATING', 'FAILED'],
  VALIDATING:      ['DONE', 'CORRECTING', 'BUDGET_EXCEEDED', 'FAILED'],
  CORRECTING:      ['APPLYING', 'FAILED'],
  DONE:            [],
  BUDGET_EXCEEDED: [],
  FAILED:          [],
}

const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  CREATED:   ['REPORTING', 'FAILED'],
  REPORTING: ['DONE', 'FAILED'],
  DONE:      [],
  FAILED:    [],
}

export type TransitionResult =
  | { ok: true; session: Session }
  | { ok: false; error: string }

export function transition(session: Session, to: SessionStatus): TransitionResult {
  let allowed: SessionStatus[]

  switch (session.type) {
    case 'discovery':
      allowed = DISCOVERY_TRANSITIONS[session.status as DiscoveryStatus] ?? []
      break
    case 'architecture':
      allowed = ARCHITECTURE_TRANSITIONS[session.status as ArchitectureStatus] ?? []
      break
    case 'implementation':
      allowed = IMPLEMENTATION_TRANSITIONS[session.status as ImplementationStatus] ?? []
      break
    case 'delivery':
      allowed = DELIVERY_TRANSITIONS[session.status as DeliveryStatus] ?? []
      break
  }

  if (!allowed.includes(to)) {
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    return {
      ok: false,
      error: `Invalid transition [${session.type}]: ${session.status} → ${to}. Allowed: ${allowedStr}`,
    }
  }

  return { ok: true, session: { ...session, status: to } as Session }
}

export function canAttemptCorrection(session: ImplementationSession): boolean {
  return session.attempts.length < session.correctionBudget
}

export function currentAttemptNumber(session: ImplementationSession): number {
  return session.attempts.length + 1
}
