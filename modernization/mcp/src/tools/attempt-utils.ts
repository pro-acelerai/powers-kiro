import type { ImplementationSession, ImplementationAttempt } from '../domain/types.js'

export function getCurrentAttempt(session: ImplementationSession): ImplementationAttempt | null {
  return session.attempts.find(a => a.status === 'IN_PROGRESS') ?? null
}
