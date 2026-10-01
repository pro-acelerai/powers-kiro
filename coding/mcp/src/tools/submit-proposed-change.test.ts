import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../trace/session-store.js'
import { handleSubmitProposedChange } from './submit-proposed-change.js'
import type { AppContext } from '../context.js'
import type { Session } from '../domain/types.js'

describe('handleSubmitProposedChange()', () => {
  let tmpDir: string
  let ctx: AppContext

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'coding-spc-test-'))
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    ctx = { workspacePath: tmpDir, store: new SessionStore(tmpDir) }
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function buildPlanningSession(): Promise<Session> {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })
    const planning: Session = { ...raw, status: 'PLANNING' }
    await ctx.store.save(planning)
    return planning
  }

  it('transitions PLANNING → PROPOSED and creates an Attempt on first call', async () => {
    const session = await buildPlanningSession()
    const targetFile = join(tmpDir, 'src', 'feature.ts')

    const result = await handleSubmitProposedChange(
      { sessionId: session.id, file: targetFile, operation: 'create', content: 'export {}', justification: 'new feature' },
      ctx
    )

    assert.equal(result.status, 'PROPOSED')
    assert.equal(result.totalChanges, 1)

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.status, 'PROPOSED')
    assert.equal(saved.attempts.length, 1)
    assert.equal(saved.attempts[0]!.status, 'IN_PROGRESS')
    assert.equal(saved.attempts[0]!.proposedChanges.length, 1)
    assert.equal(saved.attempts[0]!.proposedChanges[0]!.file, targetFile)
  })

  it('accumulates changes in the same attempt when called from PROPOSED', async () => {
    const session = await buildPlanningSession()
    const file1 = join(tmpDir, 'src', 'a.ts')
    const file2 = join(tmpDir, 'src', 'b.ts')

    await handleSubmitProposedChange(
      { sessionId: session.id, file: file1, operation: 'create', content: 'export const a = 1', justification: 'first' },
      ctx
    )
    const result = await handleSubmitProposedChange(
      { sessionId: session.id, file: file2, operation: 'create', content: 'export const b = 2', justification: 'second' },
      ctx
    )

    assert.equal(result.totalChanges, 2)

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.attempts.length, 1)
    assert.equal(saved.attempts[0]!.proposedChanges.length, 2)
  })

  it('rejects file outside scope', async () => {
    const session = await buildPlanningSession()
    const outsideFile = join(tmpDir, 'outside', 'hack.ts')

    await assert.rejects(
      () =>
        handleSubmitProposedChange(
          { sessionId: session.id, file: outsideFile, operation: 'create', content: '', justification: 'bad' },
          ctx
        ),
      /Scope violation/
    )
  })

  it('rejects when session status is not PLANNING or PROPOSED', async () => {
    const raw = await ctx.store.create({ userStory: 'test', scope: [join(tmpDir, 'src')] })
    // CREATED state

    await assert.rejects(
      () =>
        handleSubmitProposedChange(
          { sessionId: raw.id, file: join(tmpDir, 'src', 'x.ts'), operation: 'create', content: '', justification: 'x' },
          ctx
        ),
      /requires status PLANNING or PROPOSED/
    )
  })
})
