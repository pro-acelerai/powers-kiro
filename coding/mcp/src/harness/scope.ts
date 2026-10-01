import { normalize, resolve, sep, isAbsolute } from 'node:path'

// Resolve a path to an absolute, normalized form. Relative paths are resolved
// against `basePath` (the session workspace) when provided, NOT against
// process.cwd() — the server's cwd may differ from the workspace, which would
// otherwise let an in-scope relative path be mis-judged.
function abs(p: string, basePath?: string): string {
  let resolved: string
  if (isAbsolute(p)) {
    resolved = normalize(p)
  } else if (basePath) {
    resolved = normalize(resolve(basePath, p))
  } else {
    resolved = normalize(resolve(p))
  }
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function isInScope(filePath: string, scope: string[], basePath?: string): boolean {
  const normalizedFile = abs(filePath, basePath)
  return scope.some(scopePath => {
    const normalizedScope = abs(scopePath, basePath)
    return (
      normalizedFile === normalizedScope ||
      normalizedFile.startsWith(normalizedScope + sep) ||
      normalizedFile.startsWith(normalizedScope + '/')
    )
  })
}

export function assertInScope(filePath: string, scope: string[], basePath?: string): void {
  if (!isInScope(filePath, scope, basePath)) {
    throw new Error(
      `Scope violation: "${filePath}" is not within the authorized scope. ` +
      `Authorized paths: [${scope.join(', ')}]`
    )
  }
}
