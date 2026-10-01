import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  Session,
  DiscoverySession,
  ArchitectureSession,
  ImplementationSession,
  DeliverySession,
} from '../domain/types.js'

export const CORRECTION_BUDGET = 3
export const REFINEMENT_BUDGET = 2

export class SessionStore {
  private readonly traceDir: string

  constructor(workspacePath: string) {
    this.traceDir = join(workspacePath, '.kiro', 'trace', 'modernization')
  }

  async createDiscovery(params: {
    legacyPath: string
    targetStack: string
    scope: string[]
    artifactsPath: string
  }): Promise<DiscoverySession> {
    const session: DiscoverySession = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      type: 'discovery',
      status: 'CREATED',
      artifactsPath: params.artifactsPath,
      legacyPath: params.legacyPath,
      targetStack: params.targetStack,
      scope: params.scope,
      findings: [],
      specification: null,
      humanDecision: null,
      thinkRecords: [],
      refinementBudget: REFINEMENT_BUDGET,
      refinementCount: 0,
      resolution: null,
    }
    await this._write(session)
    return session
  }

  async createArchitecture(params: {
    discoverySessionId: string
    artifactsPath: string
  }): Promise<ArchitectureSession> {
    const session: ArchitectureSession = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      type: 'architecture',
      status: 'CREATED',
      artifactsPath: params.artifactsPath,
      discoverySessionId: params.discoverySessionId,
      migrationPlan: null,
      humanDecision: null,
      thinkRecords: [],
      refinementBudget: REFINEMENT_BUDGET,
      refinementCount: 0,
      resolution: null,
    }
    await this._write(session)
    return session
  }

  async createImplementation(params: {
    discoverySessionId: string
    architectureSessionId: string
    phaseId: string
    phaseNumber: number
    phaseTitle: string
    newProjectPath: string
    artifactsPath: string
  }): Promise<ImplementationSession> {
    const session: ImplementationSession = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      type: 'implementation',
      status: 'CREATED',
      artifactsPath: params.artifactsPath,
      discoverySessionId: params.discoverySessionId,
      architectureSessionId: params.architectureSessionId,
      phaseId: params.phaseId,
      phaseNumber: params.phaseNumber,
      phaseTitle: params.phaseTitle,
      newProjectPath: params.newProjectPath,
      correctionBudget: CORRECTION_BUDGET,
      attempts: [],
      thinkRecords: [],
      resolution: null,
    }
    await this._write(session)
    return session
  }

  async createDelivery(params: {
    discoverySessionId: string
    architectureSessionId: string
    implementationSessionIds: string[]
    artifactsPath: string
  }): Promise<DeliverySession> {
    const session: DeliverySession = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      type: 'delivery',
      status: 'CREATED',
      artifactsPath: params.artifactsPath,
      discoverySessionId: params.discoverySessionId,
      architectureSessionId: params.architectureSessionId,
      implementationSessionIds: params.implementationSessionIds,
      report: null,
      thinkRecords: [],
      resolution: null,
    }
    await this._write(session)
    return session
  }

  async load(sessionId: string): Promise<Session> {
    const filePath = this._filePath(sessionId)
    try {
      const raw = await readFile(filePath, 'utf-8')
      return JSON.parse(raw) as Session
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Session not found: ${sessionId}`)
      }
      throw err
    }
  }

  async save(next: Session, previous?: Session): Promise<void> {
    if (previous) {
      this._assertTypeUnchanged(next, previous)
      this._assertArtifactsPathUnchanged(next, previous)
      if (next.type === 'implementation' && previous.type === 'implementation') {
        this._assertBudgetUnchanged(next, previous)
        this._assertCompletedAttemptsUnchanged(next, previous)
      }
    }
    await this._write(next)
  }

  /**
   * Persist the final migration report as markdown.
   * Written under the session's artifactsPath (the directory the user confirmed
   * at the start of the iteration), falling back to the trace dir when omitted.
   */
  async saveReport(sessionId: string, markdown: string, artifactsPath?: string): Promise<string> {
    const targetDir = artifactsPath
      ? join(artifactsPath, 'modernization-reports')
      : this.traceDir
    await mkdir(targetDir, { recursive: true })
    const reportPath = join(targetDir, `report-${sessionId}.md`)
    await writeFile(reportPath, markdown, 'utf-8')
    return reportPath
  }

  private _assertTypeUnchanged(next: Session, previous: Session): void {
    if (next.type !== previous.type) {
      throw new Error(
        `Invariant violated: session type is immutable. ` +
        `Expected ${previous.type}, got ${next.type}`
      )
    }
  }

  private _assertArtifactsPathUnchanged(next: Session, previous: Session): void {
    if (next.artifactsPath !== previous.artifactsPath) {
      throw new Error(
        `Invariant violated: artifactsPath is immutable. ` +
        `Expected ${previous.artifactsPath}, got ${next.artifactsPath}`
      )
    }
  }

  private _assertBudgetUnchanged(next: ImplementationSession, previous: ImplementationSession): void {
    if (next.correctionBudget !== previous.correctionBudget) {
      throw new Error(
        `Invariant violated: correctionBudget is immutable. ` +
        `Expected ${previous.correctionBudget}, got ${next.correctionBudget}`
      )
    }
  }

  private _assertCompletedAttemptsUnchanged(next: ImplementationSession, previous: ImplementationSession): void {
    for (const prev of previous.attempts) {
      if (prev.status !== 'COMPLETED') continue

      const current = next.attempts.find(a => a.id === prev.id)

      if (!current) {
        throw new Error(`Invariant violated: completed attempt ${prev.id} was removed`)
      }

      if (JSON.stringify(prev) !== JSON.stringify(current)) {
        throw new Error(`Invariant violated: completed attempt ${prev.id} was modified`)
      }
    }
  }

  private async _write(session: Session): Promise<void> {
    await mkdir(this.traceDir, { recursive: true })
    await writeFile(this._filePath(session.id), JSON.stringify(session, null, 2), 'utf-8')
  }

  private _filePath(sessionId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      throw new Error(`Invalid session ID format: "${sessionId}"`)
    }
    return join(this.traceDir, `${sessionId}.json`)
  }
}
