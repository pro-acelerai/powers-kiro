import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { SessionStore } from '../trace/session-store.js'
import { handleCreateSession } from './create-session.js'
import type { AppContext } from '../context.js'

let detectedWorkspace: string
let realWorkspace: string
let ctx: AppContext

before(async () => {
  // Simulate the failure mode: the server "detected" workspace is WRONG
  // (e.g. the power install dir / home), while the user's real workspace is elsewhere.
  detectedWorkspace = realpathSync(await mkdtemp(join(tmpdir(), 'moderniz-detected-')))
  realWorkspace = realpathSync(await mkdtemp(join(tmpdir(), 'moderniz-real-')))
  ctx = { workspacePath: detectedWorkspace, store: new SessionStore(detectedWorkspace) }
})

after(async () => {
  await rm(detectedWorkspace, { recursive: true, force: true })
  await rm(realWorkspace, { recursive: true, force: true })
})

const baseDiscoveryArgs = {
  type: 'discovery' as const,
  legacyPath: '.',
  targetStack: 'Node.js',
  scope: ['.'],
}

test('absolute artifactsPath is trusted as-is (not forced into detected workspace)', async () => {
  const absolute = join(realWorkspace, 'modernization')
  const res = await handleCreateSession(
    { ...baseDiscoveryArgs, artifactsPath: absolute },
    ctx,
  ) as { artifactsPath: string }
  assert.equal(res.artifactsPath, resolve(absolute))
  // Crucially, it did NOT get rebased under the (wrong) detected workspace.
  assert.ok(!res.artifactsPath.startsWith(detectedWorkspace + sep))
})

test('absolute artifactsPath outside detected workspace is accepted (no scope error)', async () => {
  const absolute = join(realWorkspace, 'sub', 'artifacts')
  await assert.doesNotReject(() =>
    handleCreateSession({ ...baseDiscoveryArgs, artifactsPath: absolute }, ctx),
  )
})

test('relative artifactsPath resolves against the detected workspace', async () => {
  const res = await handleCreateSession(
    { ...baseDiscoveryArgs, artifactsPath: 'modernization' },
    ctx,
  ) as { artifactsPath: string }
  assert.equal(res.artifactsPath, join(detectedWorkspace, 'modernization'))
})

test('omitted artifactsPath falls back to the detected workspace', async () => {
  const res = await handleCreateSession(
    { ...baseDiscoveryArgs },
    ctx,
  ) as { artifactsPath: string }
  assert.equal(res.artifactsPath, detectedWorkspace)
})

test('architecture session inherits artifactsPath from the DONE discovery', async () => {
  const absolute = join(realWorkspace, 'artifacts-inherit')
  const disc = await handleCreateSession(
    { ...baseDiscoveryArgs, artifactsPath: absolute },
    ctx,
  ) as { sessionId: string }

  // Drive the discovery session to DONE directly via the store so we can create architecture.
  const loaded = await ctx.store.load(disc.sessionId)
  assert.equal(loaded.type, 'discovery')
  const done = { ...loaded, status: 'DONE' as const }
  await ctx.store.save(done, loaded)

  const arch = await handleCreateSession(
    { type: 'architecture', discoverySessionId: disc.sessionId },
    ctx,
  ) as { artifactsPath: string }
  assert.equal(arch.artifactsPath, resolve(absolute))
})
