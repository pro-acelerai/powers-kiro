import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../trace/session-store.js'
import { handleRunLint } from './run-lint.js'
import type { AppContext } from '../context.js'
import type { Session, Attempt, ProposedChange } from '../domain/types.js'

function makeCompletedAttempt(sessionId: string, num: number): Attempt {
  return {
    id: `attempt-${num}`,
    sessionId,
    attemptNumber: num,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: 'COMPLETED',
    proposedChanges: [],
    verificationResult: {
      id: `vr-${num}`,
      attemptId: `attempt-${num}`,
      createdAt: new Date().toISOString(),
      type: 'lint',
      status: 'FAIL',
      rawOutput: '[]',
      failureEvidence: [{ id: 'e1', file: 'x.js', line: 1, column: 1, rule: 'no-undef', message: 'x is not defined', severity: 'error' }],
    },
  }
}

describe('handleRunLint()', () => {
  let tmpDir: string
  let ctx: AppContext

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pro-coding-lint-test-'))
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    ctx = { workspacePath: tmpDir, store: new SessionStore(tmpDir) }
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function buildApplyingSession(
    changes: ProposedChange[],
    priorAttempts: Attempt[] = []
  ): Promise<Session> {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })
    const attemptId = 'current-attempt'
    const attempt: Attempt = {
      id: attemptId,
      sessionId: raw.id,
      attemptNumber: priorAttempts.length + 1,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'IN_PROGRESS',
      proposedChanges: changes,
      verificationResult: null,
    }
    const applying: Session = {
      ...raw,
      status: 'APPLYING',
      attempts: [...priorAttempts, attempt],
    }
    await ctx.store.save(applying)
    return applying
  }

  it('transitions to DONE when lint passes (valid JS file)', async () => {
    const targetFile = join(tmpDir, 'src', 'clean.js')
    await writeFile(targetFile, 'const x = 1;\nconsole.log(x);\n', 'utf-8')

    const change: ProposedChange = {
      id: 'c1', attemptId: 'current-attempt', file: targetFile,
      operation: 'create', content: 'const x = 1;\nconsole.log(x);\n',
      justification: 'test', originalContent: null,
    }

    const session = await buildApplyingSession([change])
    const result = await handleRunLint({ sessionId: session.id }, ctx)

    assert.equal(result.status, 'DONE')

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.status, 'DONE')
    assert.ok(saved.resolution, 'resolution should be set')
    assert.equal(saved.resolution!.outcome, 'DONE')
    assert.equal(saved.attempts[0]!.status, 'COMPLETED')
    assert.equal(saved.attempts[0]!.verificationResult!.status, 'PASS')
  })

  it('transitions to CORRECTING when lint fails and budget remains', async () => {
    const targetFile = join(tmpDir, 'src', 'bad.js')
    // Redeclare same var — triggers no-redeclare rule
    await writeFile(targetFile, 'var x = 1;\nvar x = 2;\n', 'utf-8')

    const change: ProposedChange = {
      id: 'c2', attemptId: 'current-attempt', file: targetFile,
      operation: 'create', content: 'var x = 1;\nvar x = 2;\n',
      justification: 'test', originalContent: null,
    }

    const session = await buildApplyingSession([change])
    const result = await handleRunLint({ sessionId: session.id }, ctx)

    assert.equal(result.status, 'CORRECTING')
    assert.ok('remainingAttempts' in result && (result as { remainingAttempts: number }).remainingAttempts > 0)

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.status, 'CORRECTING')
    assert.equal(saved.attempts[0]!.status, 'COMPLETED')
    assert.equal(saved.attempts[0]!.verificationResult!.status, 'FAIL')
    assert.ok(saved.attempts[0]!.verificationResult!.failureEvidence.length > 0)
  })

  it('transitions to BUDGET_EXCEEDED when budget is exhausted', async () => {
    const targetFile = join(tmpDir, 'src', 'bad2.js')
    await writeFile(targetFile, 'var y = 1;\nvar y = 2;\n', 'utf-8')

    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })

    // Already has correctionBudget (3) completed attempts
    const priorAttempts = [
      makeCompletedAttempt(raw.id, 1),
      makeCompletedAttempt(raw.id, 2),
      makeCompletedAttempt(raw.id, 3),
    ]

    const change: ProposedChange = {
      id: 'c3', attemptId: 'current-attempt', file: targetFile,
      operation: 'create', content: 'var y = 1;\nvar y = 2;\n',
      justification: 'test', originalContent: null,
    }

    const attempt: Attempt = {
      id: 'current-attempt',
      sessionId: raw.id,
      attemptNumber: 4,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'IN_PROGRESS',
      proposedChanges: [change],
      verificationResult: null,
    }

    const applying: Session = {
      ...raw,
      status: 'APPLYING',
      attempts: [...priorAttempts, attempt],
    }
    await ctx.store.save(applying)

    const result = await handleRunLint({ sessionId: raw.id }, ctx)

    assert.equal(result.status, 'BUDGET_EXCEEDED')

    const saved = await ctx.store.load(raw.id)
    assert.equal(saved.status, 'BUDGET_EXCEEDED')
    assert.equal(saved.resolution!.outcome, 'BUDGET_EXCEEDED')
  })

  it('transitions to DONE when all changes are deletes (SKIPPED lint)', async () => {
    const change: ProposedChange = {
      id: 'c4', attemptId: 'current-attempt', file: join(tmpDir, 'src', 'gone.js'),
      operation: 'delete', content: '',
      justification: 'remove unused file', originalContent: null,
    }

    const session = await buildApplyingSession([change])
    const result = await handleRunLint({ sessionId: session.id }, ctx)

    assert.equal(result.status, 'DONE')
  })

  it('rejects when session is not APPLYING', async () => {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })

    await assert.rejects(
      () => handleRunLint({ sessionId: raw.id }, ctx),
      /requires status APPLYING/
    )
  })
})
