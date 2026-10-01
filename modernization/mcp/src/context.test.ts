import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { realpathSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, parse } from 'node:path'
import { resolveWorkspacePath } from './context.js'

let base: string

before(async () => {
  // realpath so macOS /var → /private/var symlink doesn't break equality checks
  base = realpathSync(await mkdtemp(join(tmpdir(), 'modernization-ctx-')))
})

after(async () => {
  await rm(base, { recursive: true, force: true })
})

test('resolveWorkspacePath: returns the dir containing a .kiro marker', async () => {
  const root = join(base, 'project-kiro')
  await mkdir(join(root, '.kiro'), { recursive: true })
  assert.equal(resolveWorkspacePath(root), root)
})

test('resolveWorkspacePath: returns the dir containing a .git marker', async () => {
  const root = join(base, 'project-git')
  await mkdir(join(root, '.git'), { recursive: true })
  assert.equal(resolveWorkspacePath(root), root)
})

test('resolveWorkspacePath: walks up to the nearest marker from a nested dir', async () => {
  const root = join(base, 'project-nested')
  const nested = join(root, 'a', 'b', 'c')
  await mkdir(join(root, '.git'), { recursive: true })
  await mkdir(nested, { recursive: true })
  assert.equal(resolveWorkspacePath(nested), root)
})

test('resolveWorkspacePath: falls back to startDir when no marker exists up to filesystem root', () => {
  // The filesystem root itself never contains our markers, so starting there
  // exercises the fallback branch deterministically regardless of machine state.
  const { root } = parse(base)
  const hasMarkerAtRoot =
    existsSync(join(root, '.kiro')) || existsSync(join(root, '.git'))
  // On a clean root, resolve returns the startDir (the root) as fallback.
  if (!hasMarkerAtRoot) {
    assert.equal(resolveWorkspacePath(root), root)
  }
})

test('resolveWorkspacePath: picks the closest marker when nested projects exist', async () => {
  const outer = join(base, 'outer')
  const inner = join(outer, 'inner')
  await mkdir(join(outer, '.git'), { recursive: true })
  await mkdir(join(inner, '.kiro'), { recursive: true })
  const start = join(inner, 'src')
  await mkdir(start, { recursive: true })
  assert.equal(resolveWorkspacePath(start), inner)
})
