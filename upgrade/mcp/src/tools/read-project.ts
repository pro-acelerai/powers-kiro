import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { transition } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { AnalysisSession } from '../domain/types.js'

const IGNORED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '.kiro',
  '.next', '.nuxt', '__pycache__', '.venv', 'venv',
  'target', 'vendor', 'coverage', '.coverage',
])
const IGNORED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico',
  '.pdf', '.zip', '.tar', '.gz', '.woff', '.woff2',
  '.ttf', '.eot', '.mp4', '.mp3', '.webp', '.avif',
])
const MAX_FILE_SIZE = 500 * 1024
const MAX_TOTAL_SIZE = 50 * 1024 * 1024

async function collectFiles(dir: string, warnings: string[]): Promise<string[]> {
  const results: string[] = []
  let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[]

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      warnings.push(`Permission denied — cannot read directory: ${dir}`)
    }
    return results
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      const sub = await collectFiles(fullPath, warnings)
      results.push(...sub)
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (!IGNORED_EXTENSIONS.has(ext)) {
        results.push(fullPath)
      }
    }
  }

  return results
}

export async function handleReadProject(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'analysis') {
    throw new Error(`upgrade_read_project requires an analysis session, got ${session.type}`)
  }

  if (session.status !== 'CREATED') {
    throw new Error(`upgrade_read_project requires status CREATED, got ${session.status}`)
  }

  const analysis = session as AnalysisSession
  const files: string[] = []
  const permissionWarnings: string[] = []

  for (const scopePath of analysis.scope) {
    let info: { isDirectory(): boolean; isFile(): boolean }
    try {
      info = await stat(scopePath)
    } catch {
      continue
    }

    if (info.isDirectory()) {
      const collected = await collectFiles(scopePath, permissionWarnings)
      files.push(...collected)
    } else if (info.isFile()) {
      files.push(scopePath)
    }
  }

  const fileContents: Array<{ path: string; relativePath: string; content: string; size: number; skipped: boolean }> = []
  let totalSize = 0

  for (const filePath of files) {
    let fileSize = 0
    try {
      const s = await stat(filePath)
      fileSize = s.size
    } catch {
      continue
    }

    if (fileSize > MAX_FILE_SIZE) {
      fileContents.push({
        path: filePath,
        relativePath: relative(analysis.projectPath, filePath),
        content: '',
        size: fileSize,
        skipped: true,
      })
      totalSize += fileSize
      continue
    }

    if (totalSize + fileSize > MAX_TOTAL_SIZE) {
      permissionWarnings.push(
        `Total size limit (${MAX_TOTAL_SIZE / 1024 / 1024} MB) reached — remaining files not loaded. ` +
        `Narrow the scope or split analysis into multiple sessions.`
      )
      break
    }

    try {
      const content = await readFile(filePath, 'utf-8')
      fileContents.push({
        path: filePath,
        relativePath: relative(analysis.projectPath, filePath),
        content,
        size: fileSize,
        skipped: false,
      })
      totalSize += fileSize
    } catch {
      continue
    }
  }

  const transResult = transition(session, 'SCANNING')
  if (!transResult.ok) throw new Error(transResult.error)

  await ctx.store.save(transResult.session, session)

  return {
    sessionId: session.id,
    status: 'SCANNING',
    projectPath: analysis.projectPath,
    upgradeTarget: analysis.upgradeTarget,
    scope: analysis.scope,
    totalFiles: fileContents.length,
    totalSizeBytes: totalSize,
    skippedFiles: fileContents.filter(f => f.skipped).length,
    files: fileContents,
    warnings: permissionWarnings,
    message: permissionWarnings.length > 0
      ? `Project files loaded (${permissionWarnings.length} directories could not be read). Use upgrade_submit_think and upgrade_submit_issue to analyze. Call upgrade_submit_plan when done.`
      : 'Project files loaded. Use upgrade_submit_think and upgrade_submit_issue to analyze. Call upgrade_submit_plan when done.',
  }
}

export const readProjectToolDefinition = {
  name: 'upgrade_read_project',
  description:
    'Read all files from the project scope for upgrade analysis. ' +
    'Transitions the analysis session from CREATED to SCANNING. ' +
    'Returns full file contents for the agent to identify upgrade issues. ' +
    'Must be called before submitting issues.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The analysis session ID' },
    },
    required: ['sessionId'],
  },
}
