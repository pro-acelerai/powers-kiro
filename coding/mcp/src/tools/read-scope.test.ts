import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../trace/session-store.js'
import { handleReadScope } from './read-scope.js'
import type { AppContext } from '../context.js'

describe('handleReadScope()', () => {
  let tmpDir: string
  let ctx: AppContext

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'coding-read-scope-test-'))
    ctx = { workspacePath: tmpDir, store: new SessionStore(tmpDir) }
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function buildCreatedSession(scopePath: string) {
    return ctx.store.create({ userStory: 'test story', scope: [scopePath] })
  }

  it('rejects when session status is not CREATED', async () => {
    const srcDir = join(tmpDir, 'src-guard')
    await mkdir(srcDir, { recursive: true })
    const session = await buildCreatedSession(srcDir)
    const reading = { ...session, status: 'READING' as const }
    await ctx.store.save(reading)

    await assert.rejects(
      () => handleReadScope({ sessionId: session.id }, ctx),
      /requires status CREATED/
    )
  })

  it('reads .ts and .json files from a directory scope', async () => {
    const srcDir = join(tmpDir, 'src-dir')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'app.ts'), 'export const x = 1', 'utf-8')
    await writeFile(join(srcDir, 'config.json'), '{}', 'utf-8')

    const session = await buildCreatedSession(srcDir)
    const result = await handleReadScope({ sessionId: session.id }, ctx)

    assert.equal(result.status, 'READING')
    assert.equal(result.filesRead, 2)
    const paths = result.files.map((f: { path: string }) => f.path)
    assert.ok(paths.some((p: string) => p.endsWith('app.ts')))
    assert.ok(paths.some((p: string) => p.endsWith('config.json')))
  })

  it('reads a single file scope directly', async () => {
    const srcDir = join(tmpDir, 'src-single')
    await mkdir(srcDir, { recursive: true })
    const filePath = join(srcDir, 'only.ts')
    await writeFile(filePath, 'export {}', 'utf-8')

    const session = await buildCreatedSession(filePath)
    const result = await handleReadScope({ sessionId: session.id }, ctx)

    assert.equal(result.filesRead, 1)
    assert.equal(result.files[0].path, filePath)
  })

  it('silently skips a non-existent scope path', async () => {
    const nonExistent = join(tmpDir, 'does-not-exist')
    const session = await buildCreatedSession(nonExistent)
    const result = await handleReadScope({ sessionId: session.id }, ctx)

    assert.equal(result.status, 'READING')
    assert.equal(result.filesRead, 0)
    assert.deepEqual(result.files, [])
  })

  it('excludes files inside SKIP_DIRS (node_modules)', async () => {
    const srcDir = join(tmpDir, 'src-skip')
    const nodeModDir = join(srcDir, 'node_modules', 'some-pkg')
    await mkdir(nodeModDir, { recursive: true })
    await writeFile(join(srcDir, 'index.ts'), 'export {}', 'utf-8')
    await writeFile(join(nodeModDir, 'index.ts'), 'ignored', 'utf-8')

    const session = await buildCreatedSession(srcDir)
    const result = await handleReadScope({ sessionId: session.id }, ctx)

    assert.equal(result.filesRead, 1)
    const paths = result.files.map((f: { path: string }) => f.path)
    assert.ok(!paths.some((p: string) => p.includes('node_modules')))
  })

  it('excludes files with non-text extensions', async () => {
    const srcDir = join(tmpDir, 'src-ext')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'image.png'), Buffer.from([0x89, 0x50]))
    await writeFile(join(srcDir, 'main.ts'), 'export {}', 'utf-8')

    const session = await buildCreatedSession(srcDir)
    const result = await handleReadScope({ sessionId: session.id }, ctx)

    assert.equal(result.filesRead, 1)
    assert.ok(result.files[0].path.endsWith('main.ts'))
  })

  it('excludes files larger than 500 KB', async () => {
    const srcDir = join(tmpDir, 'src-size')
    await mkdir(srcDir, { recursive: true })
    const bigContent = 'x'.repeat(500 * 1024 + 1)
    await writeFile(join(srcDir, 'big.ts'), bigContent, 'utf-8')
    await writeFile(join(srcDir, 'small.ts'), 'export {}', 'utf-8')

    const session = await buildCreatedSession(srcDir)
    const result = await handleReadScope({ sessionId: session.id }, ctx)

    assert.equal(result.filesRead, 1)
    assert.ok(result.files[0].path.endsWith('small.ts'))
  })

  it('transitions session to READING in the store', async () => {
    const srcDir = join(tmpDir, 'src-transition')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'a.ts'), 'export {}', 'utf-8')

    const session = await buildCreatedSession(srcDir)
    await handleReadScope({ sessionId: session.id }, ctx)

    const saved = await ctx.store.load(session.id)
    assert.equal(saved.status, 'READING')
  })

  it('returns the expected response shape', async () => {
    const srcDir = join(tmpDir, 'src-shape')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'x.ts'), 'export {}', 'utf-8')

    const session = await buildCreatedSession(srcDir)
    const result = await handleReadScope({ sessionId: session.id }, ctx)

    assert.equal(result.sessionId, session.id)
    assert.equal(result.status, 'READING')
    assert.equal(typeof result.filesRead, 'number')
    assert.ok(Array.isArray(result.files))
    assert.ok(typeof result.message === 'string')
  })
})
