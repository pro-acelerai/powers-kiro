import { normalize, resolve, sep, isAbsolute } from 'node:path'

function abs(p: string): string {
  const resolved = isAbsolute(p) ? normalize(p) : normalize(resolve(p))
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function isInScope(filePath: string, scope: string[]): boolean {
  const normalizedFile = abs(filePath)
  return scope.some(scopePath => {
    const normalizedScope = abs(scopePath)
    return (
      normalizedFile === normalizedScope ||
      normalizedFile.startsWith(normalizedScope + sep) ||
      normalizedFile.startsWith(normalizedScope + '/')
    )
  })
}

export function assertInScope(filePath: string, scope: string[]): void {
  if (!isInScope(filePath, scope)) {
    throw new Error(
      `Scope violation: "${filePath}" is not within the authorized scope. ` +
      `Authorized paths: [${scope.join(', ')}]`
    )
  }
}
