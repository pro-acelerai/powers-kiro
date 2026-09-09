import { SessionStore } from './trace/session-store.js'

export interface AppContext {
  workspacePath: string
  store: SessionStore
}

export function createContext(): AppContext {
  const workspacePath = process.env['STORY_CODER_WORKSPACE'] ?? process.cwd()
  return {
    workspacePath,
    store: new SessionStore(workspacePath),
  }
}
