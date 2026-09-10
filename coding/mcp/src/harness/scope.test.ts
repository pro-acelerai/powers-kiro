import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { isInScope, assertInScope } from './scope.js'

const BASE = resolve('C:/workspace/project')
const scope = [BASE, resolve('C:/workspace/project/src')]

describe('isInScope()', () => {
  it('returns true for a file directly in scope directory', () => {
    assert.equal(isInScope(resolve(BASE, 'index.ts'), scope), true)
  })

  it('returns true for a file in a subdirectory of scope', () => {
    assert.equal(isInScope(resolve(BASE, 'src', 'service', 'user.ts'), scope), true)
  })

  it('returns true for an exact scope path match', () => {
    assert.equal(isInScope(BASE, scope), true)
  })

  it('returns false for a file outside scope', () => {
    assert.equal(isInScope(resolve('C:/workspace/other-project/secret.ts'), scope), false)
  })

  it('returns false for a path traversal attempt (../)', () => {
    assert.equal(isInScope(resolve(BASE, '..', 'other', 'file.ts'), scope), false)
  })

  it('returns false for a sibling directory not in scope', () => {
    assert.equal(isInScope(resolve('C:/workspace/project-evil/code.ts'), scope), false)
  })
})

describe('assertInScope()', () => {
  it('does not throw for a path within scope', () => {
    assert.doesNotThrow(() =>
      assertInScope(resolve(BASE, 'src', 'app.ts'), scope)
    )
  })

  it('throws with a clear message for a path outside scope', () => {
    assert.throws(
      () => assertInScope(resolve('C:/etc/passwd'), scope),
      /Scope violation/
    )
  })

  it('error message includes the violating path', () => {
    const badPath = resolve('C:/outside/file.ts')
    let message = ''
    try {
      assertInScope(badPath, scope)
    } catch (e) {
      message = (e as Error).message
    }
    assert.ok(message.includes('outside'), `Expected path in error, got: ${message}`)
  })
})

describe('isInScope() with basePath (relative paths)', () => {
  it('resolves a relative file against basePath, not cwd', () => {
    // "src/app.ts" relative to BASE is in scope, regardless of process.cwd().
    assert.equal(isInScope('src/app.ts', scope, BASE), true)
  })

  it('rejects a relative traversal that escapes basePath', () => {
    assert.equal(isInScope('../other/file.ts', scope, BASE), false)
  })

  it('still handles absolute paths when basePath is provided', () => {
    assert.equal(isInScope(resolve(BASE, 'src', 'x.ts'), scope, BASE), true)
    assert.equal(isInScope(resolve('C:/elsewhere/x.ts'), scope, BASE), false)
  })
})
