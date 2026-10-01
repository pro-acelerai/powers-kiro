import type { Session, SessionStatus } from './types.js'

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  CREATED:        ['READING'],
  READING:        ['PLANNING'],
  PLANNING:       ['PROPOSED'],
  PROPOSED:       ['APPROVED', 'REJECTED'],
  APPROVED:       ['APPLYING'],
  APPLYING:       ['VERIFYING'],
  VERIFYING:      ['DONE', 'CORRECTING', 'BUDGET_EXCEEDED'],
  CORRECTING:     ['APPLYING'],
  DONE:           [],
  REJECTED:       [],
  BUDGET_EXCEEDED:[],
  FAILED:         [],
}

export type TransitionResult =
  | { ok: true; session: Session }
  | { ok: false; error: string }

export function transition(session: Session, to: SessionStatus): TransitionResult {
  const allowed = VALID_TRANSITIONS[session.status]

  if (!allowed.includes(to)) {
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    return {
      ok: false,
      error: `Invalid transition: ${session.status} → ${to}. Allowed from ${session.status}: ${allowedStr}`,
    }
  }

  return { ok: true, session: { ...session, status: to } }
}

export function canAttemptCorrection(session: Session): boolean {
  return session.attempts.length < session.correctionBudget
}

export function currentAttemptNumber(session: Session): number {
  return session.attempts.length + 1
}
