import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Session } from '../domain/types.js'

export const CORRECTION_BUDGET = 3

export class SessionStore {
  private readonly traceDir: string

  constructor(workspacePath: string) {
    this.traceDir = join(workspacePath, '.kiro', 'trace')
  }

  async create(params: { userStory: string; scope: string[] }): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      userStory: params.userStory,
      scope: params.scope,
      correctionBudget: CORRECTION_BUDGET,
      status: 'CREATED',
      plan: null,
      humanDecision: null,
      attempts: [],
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
    } catch {
      throw new Error(`Session not found: ${sessionId}`)
    }
  }

  /**
   * Persiste `next` no disco.
   * @param previous - Sessão anterior. Obrigatório em todos os updates de produção —
   *   omitir desabilita os checks de invariant. Só omita em gravações iniciais onde
   *   não há estado anterior a comparar (use `create()` para esse caso).
   */
  async save(next: Session, previous?: Session): Promise<void> {
    if (previous) {
      this._assertBudgetUnchanged(next, previous)
      this._assertCompletedAttemptsUnchanged(next, previous)
    }
    await this._write(next)
  }

  private _assertBudgetUnchanged(next: Session, previous: Session): void {
    if (next.correctionBudget !== previous.correctionBudget) {
      throw new Error(
        `Invariant violated: correctionBudget is immutable. ` +
        `Expected ${previous.correctionBudget}, got ${next.correctionBudget}`
      )
    }
  }

  private _assertCompletedAttemptsUnchanged(next: Session, previous: Session): void {
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
    const finalPath = this._filePath(session.id)
    // Atomic write: serialize to a temp file, then rename into place. A crash
    // mid-write leaves the .tmp file, never a truncated/corrupt session trace.
    const tmpPath = `${finalPath}.${randomUUID()}.tmp`
    try {
      await writeFile(tmpPath, JSON.stringify(session, null, 2), 'utf-8')
      await rename(tmpPath, finalPath)
    } catch (err) {
      await unlink(tmpPath).catch(() => { /* temp may not exist */ })
      throw err
    }
  }

  private _filePath(sessionId: string): string {
    return join(this.traceDir, `${sessionId}.json`)
  }
}
