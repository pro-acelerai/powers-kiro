export type SessionType = 'discovery' | 'architecture' | 'implementation' | 'delivery'

// --- Status types per session type ---

export type DiscoveryStatus =
  | 'CREATED'
  | 'ANALYZING'
  | 'TRIAGE_REVIEW'
  | 'SPECIFYING'
  | 'SPEC_REVIEW'
  | 'DONE'
  | 'REJECTED'
  | 'FAILED'

export type ArchitectureStatus =
  | 'CREATED'
  | 'PLANNING'
  | 'PLAN_REVIEW'
  | 'DONE'
  | 'REJECTED'
  | 'FAILED'

export type ImplementationStatus =
  | 'CREATED'
  | 'BUILDING'
  | 'APPLYING'
  | 'VALIDATING'
  | 'CORRECTING'
  | 'DONE'
  | 'BUDGET_EXCEEDED'
  | 'FAILED'

export type DeliveryStatus =
  | 'CREATED'
  | 'REPORTING'
  | 'DONE'
  | 'FAILED'

export type SessionStatus =
  | DiscoveryStatus
  | ArchitectureStatus
  | ImplementationStatus
  | DeliveryStatus

// --- Findings ---

export type FindingClassification = 'MIGRATE_AND_FIX' | 'BLOCKER' | 'DOCUMENT'
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type TriageResolution = 'fix_before' | 'descope' | 'accept_risk'

export interface TriageDecision {
  id: string
  findingId: string
  decidedAt: string
  resolution: TriageResolution
  notes: string
}

export interface Finding {
  id: string
  sessionId: string
  createdAt: string
  file: string
  line: number | null
  classification: FindingClassification
  severity: FindingSeverity
  title: string
  description: string
  recommendation: string
  triageDecision: TriageDecision | null
}

// --- Specification (extracted from legacy) ---

export interface SpecEntity {
  name: string
  description: string
  attributes: string[]
}

export interface SpecRule {
  id: string
  title: string
  description: string
  sourceRef: string
}

export interface SpecFlow {
  id: string
  name: string
  steps: string[]
  sourceRef: string
}

export interface SpecContract {
  id: string
  type: 'rest_api' | 'event' | 'database' | 'external_service'
  name: string
  description: string
  sourceRef: string
}

export type DatabaseRuleType = 'trigger' | 'stored_procedure' | 'scheduled_job' | 'view' | 'function' | 'other'
export type DatabaseRuleDecision = 'migrate' | 'reimplement_in_application' | 'drop' | 'keep_as_is'

export interface DatabaseRule {
  id: string
  name: string
  type: DatabaseRuleType
  description: string
  decision: DatabaseRuleDecision
  rationale: string
  sourceRef: string
}

export interface ExcludedScope {
  path: string
  reason: string
}

export interface Specification {
  id: string
  sessionId: string
  createdAt: string
  version: number
  domainEntities: SpecEntity[]
  businessRules: SpecRule[]
  flows: SpecFlow[]
  externalContracts: SpecContract[]
  databaseRules: DatabaseRule[]
  excludedScope: ExcludedScope[]
  nonFunctional: string[]
  rawMarkdown: string
}

// --- Migration Plan ---

export type PhaseComplexity = 'low' | 'medium' | 'high'

export interface MigrationPhase {
  id: string
  number: number
  title: string
  description: string
  targetModule: string
  dependencies: string[]
  estimatedComplexity: PhaseComplexity
}

export interface MigrationPlan {
  id: string
  sessionId: string
  createdAt: string
  version: number
  targetStack: string
  newProjectName: string
  newProjectPath: string
  architectureDecisions: string[]
  phases: MigrationPhase[]
  rawMarkdown: string
}

// --- Think records ---

export interface ThinkRecord {
  id: string
  sessionId: string
  createdAt: string
  phase: string
  reasoning: string
}

// --- Human decisions and resolution ---

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

// --- Implementation attempt types ---

export type FileOperation = 'create' | 'modify'
export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED'
export type VerificationStatus = 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED'

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

export interface NewFile {
  id: string
  sessionId: string
  attemptId: string
  file: string
  operation: FileOperation
  content: string
  justification: string
  specRefs: string[]
}

export interface ImplementationAttempt {
  id: string
  sessionId: string
  attemptNumber: number
  createdAt: string
  completedAt: string | null
  status: AttemptStatus
  newFiles: NewFile[]
  verificationResult: VerificationResult | null
}

// --- Sessions (discriminated union by type) ---

interface BaseSession {
  id: string
  createdAt: string
  type: SessionType
  status: SessionStatus
  // Base directory where all artifacts of this iteration are written
  // (HTML report, final report, new project). Confirmed by the user at the
  // start of the discovery session and inherited by all downstream sessions.
  artifactsPath: string
  thinkRecords: ThinkRecord[]
  resolution: Resolution | null
}

export interface DiscoverySession extends BaseSession {
  type: 'discovery'
  status: DiscoveryStatus
  legacyPath: string
  targetStack: string
  scope: string[]
  findings: Finding[]
  specification: Specification | null
  humanDecision: HumanDecision | null
  refinementBudget: number
  refinementCount: number
}

export interface ArchitectureSession extends BaseSession {
  type: 'architecture'
  status: ArchitectureStatus
  discoverySessionId: string
  migrationPlan: MigrationPlan | null
  humanDecision: HumanDecision | null
  refinementBudget: number
  refinementCount: number
}

export interface ImplementationSession extends BaseSession {
  type: 'implementation'
  status: ImplementationStatus
  discoverySessionId: string
  architectureSessionId: string
  phaseId: string
  phaseNumber: number
  phaseTitle: string
  newProjectPath: string
  correctionBudget: number
  attempts: ImplementationAttempt[]
}

export interface DeliverySession extends BaseSession {
  type: 'delivery'
  status: DeliveryStatus
  discoverySessionId: string
  architectureSessionId: string
  implementationSessionIds: string[]
  report: string | null
}

export type Session =
  | DiscoverySession
  | ArchitectureSession
  | ImplementationSession
  | DeliverySession
