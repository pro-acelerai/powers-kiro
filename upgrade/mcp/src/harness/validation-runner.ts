import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface CommandResult {
  status: 'PASS' | 'FAIL' | 'ERROR'
  output: string
  exitCode: number
}

export async function runValidationCommand(command: string, cwd: string): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 300_000,
    })
    const output = [stdout, stderr].filter(Boolean).join('\n')
    return { status: 'PASS', output, exitCode: 0 }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number }
    if (e.code !== undefined && typeof e.code === 'number') {
      const output = [e.stdout ?? '', e.stderr ?? ''].filter(Boolean).join('\n')
      return { status: 'FAIL', output, exitCode: e.code }
    }
    const message = err instanceof Error ? err.message : String(err)
    return { status: 'ERROR', output: message, exitCode: -1 }
  }
}
