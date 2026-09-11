import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import { SessionStore } from './trace/session-store.js'

export interface AppContext {
  workspacePath: string
  store: SessionStore
}

const WORKSPACE_MARKERS = ['.kiro', '.git']

export function resolveWorkspacePath(startDir: string = process.cwd()): string {
  let current = startDir
  const { root } = parse(current)

  while (true) {
    const hasMarker = WORKSPACE_MARKERS.some(marker => existsSync(join(current, marker)))
    if (hasMarker) return current

    if (current === root) break
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  return startDir
}

export function createContext(): AppContext {
  const workspacePath = resolveWorkspacePath()
  return {
    workspacePath,
    store: new SessionStore(workspacePath),
  }
}
