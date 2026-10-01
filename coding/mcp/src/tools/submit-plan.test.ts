import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../trace/session-store.js'
import { handleSubmitPlan } from './submit-plan.js'
import type { AppContext } from '../context.js'

describe('handleSubmitPlan()', () => {
  let tmpDir: string
  let ctx: AppContext

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'coding-plan-test-'))
    ctx = { workspacePath: tmpDir, store: new SessionStore(tmpDir) }
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('transitions READING → PLANNING and stores the plan', async () => {
    const raw = await ctx.store.create({ userStory: 'test story', scope: [join(tmpDir, 'src')] })
    // Force to READING state
    const reading = { ...raw, status: 'READING' as const }
    await ctx.store.save(reading)

    const result = await handleSubmitPlan(
      { sessionId: raw.id, reasoning: 'Add X feature', filesConsidered: [join(tmpDir, 'src', 'app.ts')] },
      ctx
    )

    assert.equal(result.status, 'PLANNING')
    assert.ok(result.planId, 'planId should be set')

    const saved = await ctx.store.load(raw.id)
    assert.equal(saved.status, 'PLANNING')
    assert.ok(saved.plan, 'plan should be stored on session')
    assert.equal(saved.plan!.reasoning, 'Add X feature')
    assert.deepEqual(saved.plan!.filesConsidered, [join(tmpDir, 'src', 'app.ts')])
  })

  it('rejects when session is not in READING state', async () => {
    const raw = await ctx.store.create({ userStory: 'test story', scope: [join(tmpDir, 'src')] })
    // CREATED state — not READING

    await assert.rejects(
      () => handleSubmitPlan({ sessionId: raw.id, reasoning: 'plan', filesConsidered: [] }, ctx),
      /requires status READING/
    )
  })

  it('rejects empty reasoning', async () => {
    const raw = await ctx.store.create({ userStory: 'test story', scope: [join(tmpDir, 'src')] })
    const reading = { ...raw, status: 'READING' as const }
    await ctx.store.save(reading)

    await assert.rejects(
      () => handleSubmitPlan({ sessionId: raw.id, reasoning: '   ', filesConsidered: [] }, ctx),
      /reasoning is required/
    )
  })
})
