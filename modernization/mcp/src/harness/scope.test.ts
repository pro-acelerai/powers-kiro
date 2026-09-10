import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { isInScope, assertInScope } from './scope.js'

// Use resolved absolute paths so the tests are cross-platform.
const root = resolve('/project')
const srcDir = resolve('/project/src')
const modelsDir = resolve('/project/models')

test('isInScope: exact match of a scope path', () => {
  assert.equal(isInScope(srcDir, [srcDir]), true)
})

test('isInScope: file nested inside a scope directory', () => {
  assert.equal(isInScope(resolve('/project/src/app.ts'), [srcDir]), true)
  assert.equal(isInScope(resolve('/project/src/deep/nested/file.ts'), [srcDir]), true)
})

test('isInScope: file outside all scope directories', () => {
  assert.equal(isInScope(resolve('/project/other/file.ts'), [srcDir]), false)
})

test('isInScope: matches when any scope path contains the file', () => {
  assert.equal(isInScope(resolve('/project/models/user.ts'), [srcDir, modelsDir]), true)
})

test('isInScope: sibling with shared prefix is NOT in scope', () => {
  // "/project/src-extra" should not match scope "/project/src"
  assert.equal(isInScope(resolve('/project/src-extra/file.ts'), [srcDir]), false)
})

test('isInScope: empty scope means nothing is in scope', () => {
  assert.equal(isInScope(resolve('/project/src/app.ts'), []), false)
})

test('isInScope: case-insensitive matching on win32', { skip: process.platform !== 'win32' }, () => {
  assert.equal(isInScope('C:\\Project\\SRC\\app.ts', ['c:\\project\\src']), true)
})

test('assertInScope: does not throw for in-scope path', () => {
  assert.doesNotThrow(() => assertInScope(resolve('/project/src/app.ts'), [srcDir]))
})

test('assertInScope: throws for out-of-scope path with helpful message', () => {
  assert.throws(
    () => assertInScope(resolve('/project/other/file.ts'), [srcDir]),
    /Scope violation/,
  )
})

// keep `root` referenced to avoid unused-var noise if strict linting runs
test('root fixture resolves to an absolute path', () => {
  assert.ok(root.length > 0)
})
