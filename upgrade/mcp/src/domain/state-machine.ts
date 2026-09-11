import type {
  Session,
  SessionStatus,
  AnalysisStatus,
  ExecutionStatus,
  ExecutionSession,
} from './types.js'

const ANALYSIS_TRANSITIONS: Record<AnalysisStatus, AnalysisStatus[]> = {
  CREATED:     ['SCANNING', 'FAILED'],
  SCANNING:    ['PLAN_REVIEW', 'FAILED'],
  PLAN_REVIEW: ['DONE', 'SCANNING', 'REJECTED', 'FAILED'],
  DONE:        [],
  REJECTED:    [],
  FAILED:      [],
}

const EXECUTION_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  CREATED:         ['LOADING', 'FAILED'],
  LOADING:         ['APPLYING', 'FAILED'],
  APPLYING:        ['VALIDATING', 'FAILED'],
  VALIDATING:      ['DONE', 'CORRECTING', 'BUDGET_EXCEEDED', 'FAILED'],
  CORRECTING:      ['APPLYING', 'FAILED'],
  DONE:            [],
  BUDGET_EXCEEDED: [],
  FAILED:          [],
}

export type TransitionResult =
  | { ok: true; session: Session }
  | { ok: false; error: string }

export function transition(session: Session, to: SessionStatus): TransitionResult {
  let allowed: SessionStatus[]

  switch (session.type) {
    case 'analysis':
      allowed = ANALYSIS_TRANSITIONS[session.status as AnalysisStatus] ?? []
      break
    case 'execution':
      allowed = EXECUTION_TRANSITIONS[session.status as ExecutionStatus] ?? []
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

export function canAttemptCorrection(session: ExecutionSession): boolean {
  return session.attempts.length < session.correctionBudget
}

export function currentAttemptNumber(session: ExecutionSession): number {
  return session.attempts.length + 1
}
