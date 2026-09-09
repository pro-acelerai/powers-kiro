import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { isInScope } from '../harness/scope.js'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.kiro', '.next', 'coverage'])

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.jsonc',
  '.md', '.mdx',
  '.yaml', '.yml',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.sql', '.graphql', '.gql',
  '.py', '.java', '.go', '.rs', '.rb', '.php', '.cs', '.cpp', '.c', '.h',
  '.sh', '.bash', '.zsh', '.fish',
  '.env', '.env.example',
  '.txt', '.xml', '.toml', '.ini', '.conf', '.config',
])

const MAX_FILE_SIZE = 500 * 1024  // 500 KB

interface FileEntry {
  path: string
  content: string
}

async function collectFiles(dirPath: string, scope: string[]): Promise<FileEntry[]> {
  const results: FileEntry[] = []

  let entries: string[]
  try {
    entries = await readdir(dirPath, { recursive: true }) as string[]
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry)

    // Skip directories that should not be read
    const parts = entry.split(/[/\\]/)
    if (parts.some(p => SKIP_DIRS.has(p))) continue

    // Only include text file extensions
    if (!TEXT_EXTENSIONS.has(extname(fullPath).toLowerCase())) continue

    // Must be within scope
    if (!isInScope(fullPath, scope)) continue

    let fileStat
    try {
      fileStat = await stat(fullPath)
    } catch {
      continue
    }

    if (!fileStat.isFile()) continue
    if (fileStat.size > MAX_FILE_SIZE) continue

    try {
      const content = await readFile(fullPath, 'utf-8')
      results.push({ path: fullPath, content })
    } catch {
      // Skip unreadable files
    }
  }

  return results
}

export async function handleReadScope(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.status !== 'CREATED') {
    throw new Error(`read_scope requires status CREATED, got ${session.status}`)
  }

  const files: FileEntry[] = []

  for (const scopePath of session.scope) {
    const resolvedPath = resolve(ctx.workspacePath, scopePath)
    const s = await stat(resolvedPath).catch(() => null)

    if (!s) continue

    if (s.isDirectory()) {
      const found = await collectFiles(resolvedPath, session.scope)
      files.push(...found)
    } else if (s.isFile()) {
      if (isInScope(resolvedPath, session.scope) && s.size <= MAX_FILE_SIZE) {
        try {
          const content = await readFile(resolvedPath, 'utf-8')
          files.push({ path: resolvedPath, content })
        } catch { /* skip */ }
      }
    }
  }

  // Transition CREATED → READING
  const result = transition(session, 'READING')
  if (!result.ok) throw new Error(result.error)
  await ctx.store.save(result.session, session)

  return {
    sessionId: session.id,
    status: 'READING',
    filesRead: files.length,
    files,
    message: 'Scope read. Reason about the requirements and call submit_plan.',
  }
}

export const readScopeToolDefinition = {
  name: 'pro-coding_read_scope',
  description:
    'Read all files within the authorized scope. ' +
    'Call this after create_session to load context before planning.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The session ID returned by create_session' },
    },
    required: ['sessionId'],
  },
}
