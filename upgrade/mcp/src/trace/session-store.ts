import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  Session,
  AnalysisSession,
  ExecutionSession,
} from '../domain/types.js'

export const CORRECTION_BUDGET = 3
export const REFINEMENT_BUDGET = 2

export class SessionStore {
  private readonly traceDir: string

  constructor(artifactsPath: string) {
    this.traceDir = join(artifactsPath, '.kiro', 'trace', 'upgrade')
  }

  async createAnalysis(params: {
    projectPath: string
    upgradeTarget: string
    scope: string[]
    validationCommand: string
    artifactsPath: string
  }): Promise<AnalysisSession> {
    const session: AnalysisSession = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      type: 'analysis',
      status: 'CREATED',
      projectPath: params.projectPath,
      upgradeTarget: params.upgradeTarget,
      scope: params.scope,
      validationCommand: params.validationCommand,
      artifactsPath: params.artifactsPath,
      issues: [],
      plan: null,
      humanDecision: null,
      thinkRecords: [],
      refinementBudget: REFINEMENT_BUDGET,
      refinementCount: 0,
      resolution: null,
    }
    await this._write(session)
    return session
  }

  async createExecution(params: {
    analysisSessionId: string
    projectPath: string
    upgradeTarget: string
    scope: string[]
    validationCommand: string
    artifactsPath: string
  }): Promise<ExecutionSession> {
    const session: ExecutionSession = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      type: 'execution',
      status: 'CREATED',
      analysisSessionId: params.analysisSessionId,
      projectPath: params.projectPath,
      upgradeTarget: params.upgradeTarget,
      scope: params.scope,
      validationCommand: params.validationCommand,
      artifactsPath: params.artifactsPath,
      correctionBudget: CORRECTION_BUDGET,
      attempts: [],
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
      if (next.type === 'execution' && previous.type === 'execution') {
        this._assertBudgetUnchanged(next, previous)
        this._assertCompletedAttemptsUnchanged(next, previous)
      }
    }
    await this._write(next)
  }

  async saveReport(artifactsPath: string, sessionId: string, markdown: string): Promise<string> {
    const targetDir = join(artifactsPath, '.kiro', 'trace', 'upgrade')
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

  private _assertBudgetUnchanged(next: ExecutionSession, previous: ExecutionSession): void {
    if (next.correctionBudget !== previous.correctionBudget) {
      throw new Error(
        `Invariant violated: correctionBudget is immutable. ` +
        `Expected ${previous.correctionBudget}, got ${next.correctionBudget}`
      )
    }
  }

  private _assertCompletedAttemptsUnchanged(next: ExecutionSession, previous: ExecutionSession): void {
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
