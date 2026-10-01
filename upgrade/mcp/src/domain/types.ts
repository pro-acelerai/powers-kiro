export type SessionType = 'analysis' | 'execution'

export type AnalysisStatus =
  | 'CREATED' | 'SCANNING' | 'PLAN_REVIEW'
  | 'DONE' | 'REJECTED' | 'FAILED'

export type ExecutionStatus =
  | 'CREATED' | 'LOADING' | 'APPLYING' | 'VALIDATING'
  | 'CORRECTING' | 'DONE' | 'BUDGET_EXCEEDED' | 'FAILED'

export type SessionStatus = AnalysisStatus | ExecutionStatus

export type IssueType =
  | 'breaking_api' | 'deprecated_usage' | 'cve'
  | 'syntax_idiom' | 'toolchain' | 'incompatible_dep'

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IssueStatus = 'must_fix' | 'recommended' | 'optional'
export type ChangeOperation = 'create' | 'modify' | 'delete'
export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED'
export type VerificationStatus = 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface Issue {
  id: string
  sessionId: string
  createdAt: string
  file: string
  line: number | null
  type: IssueType
  severity: IssueSeverity
  status: IssueStatus
  title: string
  description: string
  recommendation: string
}

export interface PlannedChange {
  id: string
  file: string
  description: string
  issueRefs: string[]
  riskLevel: RiskLevel
}

export interface UpgradePlan {
  id: string
  sessionId: string
  createdAt: string
  version: number
  upgradeTarget: string
  reasoning: string
  changes: PlannedChange[]
  rawMarkdown: string
}

export interface ThinkRecord {
  id: string
  sessionId: string
  createdAt: string
  phase: string
  reasoning: string
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

export interface FailureEvidence {
  id: string
  file: string
  line: number
  column: number
  rule: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  id: string
  attemptId: string
  createdAt: string
  lintStatus: VerificationStatus
  commandStatus: VerificationStatus
  rawLintOutput: string
  rawCommandOutput: string
  validationCommand: string | null
  failureEvidence: FailureEvidence[]
}

export interface FileChange {
  id: string
  sessionId: string
  attemptId: string
  file: string
  operation: ChangeOperation
  content: string
  originalContent: string | null
  justification: string
  issueRefs: string[]
}

export interface Attempt {
  id: string
  sessionId: string
  attemptNumber: number
  createdAt: string
  completedAt: string | null
  status: AttemptStatus
  fileChanges: FileChange[]
  validationResult: ValidationResult | null
}

interface BaseSession {
  id: string
  createdAt: string
  type: SessionType
  status: SessionStatus
  thinkRecords: ThinkRecord[]
  resolution: Resolution | null
}

export interface AnalysisSession extends BaseSession {
  type: 'analysis'
  status: AnalysisStatus
  projectPath: string
  upgradeTarget: string
  scope: string[]
  validationCommand: string
  artifactsPath: string
  issues: Issue[]
  plan: UpgradePlan | null
  humanDecision: HumanDecision | null
  refinementBudget: number
  refinementCount: number
}

export interface ExecutionSession extends BaseSession {
  type: 'execution'
  status: ExecutionStatus
  analysisSessionId: string
  projectPath: string
  upgradeTarget: string
  scope: string[]
  validationCommand: string
  artifactsPath: string
  correctionBudget: number
  attempts: Attempt[]
}

export type Session = AnalysisSession | ExecutionSession
