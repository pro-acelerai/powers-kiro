import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import { SessionStore } from './trace/session-store.js'

export interface AppContext {
  workspacePath: string
  store: SessionStore
}

// Markers that identify the root of a user's workspace/project.
const WORKSPACE_MARKERS = ['.kiro', '.git']

/**
 * Resolve the workspace root by walking up the directory tree from `startDir`,
 * looking for a directory that contains a workspace marker (`.kiro` or `.git`).
 *
 * The MCP server process may be started from the power's install directory
 * (e.g. `.kiro/powers/installeds/...`) rather than the user's open workspace,
 * so `process.cwd()` alone is not reliable. Walking up to the nearest marker
 * anchors all generated artifacts to the real project root.
 *
 * Falls back to `startDir` when no marker is found.
 */
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
