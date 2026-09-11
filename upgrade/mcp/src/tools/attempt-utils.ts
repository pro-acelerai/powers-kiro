import type { ExecutionSession, Attempt } from '../domain/types.js'

export function getCurrentAttempt(session: ExecutionSession): Attempt | null {
  return session.attempts.find(a => a.status === 'IN_PROGRESS') ?? null
}
