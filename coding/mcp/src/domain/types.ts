export type SessionStatus =
  | 'CREATED'
  | 'READING'
  | 'PLANNING'
  | 'PROPOSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPLYING'
  | 'VERIFYING'
  | 'CORRECTING'
  | 'DONE'
  | 'BUDGET_EXCEEDED'
  | 'FAILED'

export type ChangeOperation = 'create' | 'modify' | 'delete'

export type VerificationStatus = 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED'

export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED'

export interface FailureEvidence {
  id: string
  file: string
  line: number
  column: number
  rule: string
  message: string
  severity: 'error' | 'warning'
}

export interface VerificationResult {
  id: string
  attemptId: string
  createdAt: string
  type: 'lint'
  status: VerificationStatus
  rawOutput: string
  failureEvidence: FailureEvidence[]
}

export interface ProposedChange {
  id: string
  attemptId: string
  file: string               // validated against scope by Harness before accept
  operation: ChangeOperation
  content: string            // full new content of the file
  justification: string
  originalContent: string | null  // saved by Harness before first apply
}

export interface Attempt {
  id: string
  sessionId: string
  attemptNumber: number      // 1, 2, or 3
  createdAt: string
  completedAt: string | null
  status: AttemptStatus
  proposedChanges: ProposedChange[]
  verificationResult: VerificationResult | null
}

export interface Plan {
  id: string
  sessionId: string
  createdAt: string
  reasoning: string
  filesConsidered: string[]
}

export interface HumanDecision {
  id: string
  sessionId: string
  decidedAt: string
  approved: boolean
  notes: string
}

export interface Resolution {
  id: string
  sessionId: string
  resolvedAt: string
  outcome: 'DONE' | 'REJECTED' | 'BUDGET_EXCEEDED' | 'FAILED'
}

// The full trace — everything produced during the session
export interface Session {
  id: string
  createdAt: string
  userStory: string
  scope: string[]
  correctionBudget: number  // fixed at CORRECTION_BUDGET, owned by Harness, never changes
  status: SessionStatus
  plan: Plan | null
  humanDecision: HumanDecision | null
  attempts: Attempt[]
  resolution: Resolution | null
}
