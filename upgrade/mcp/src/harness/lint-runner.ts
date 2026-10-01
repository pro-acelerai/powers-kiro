import { ESLint } from 'eslint'
import js from '@eslint/js'
import globals from 'globals'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { FailureEvidence, VerificationStatus } from '../domain/types.js'

const CONFIG_FILES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs']
const TS_EXTENSIONS = /\.[mc]?tsx?$/i

export interface LintResult {
  id: string
  attemptId: string
  createdAt: string
  status: VerificationStatus
  rawOutput: string
  failureEvidence: FailureEvidence[]
}

function hasProjectConfig(projectPath: string): boolean {
  return CONFIG_FILES.some(f => existsSync(join(projectPath, f)))
}

export async function runLint(
  files: string[],
  attemptId: string,
  projectPath: string
): Promise<LintResult> {
  if (files.length === 0) {
    return {
      id: randomUUID(),
      attemptId,
      createdAt: new Date().toISOString(),
      status: 'SKIPPED',
      rawOutput: 'No files to lint.',
      failureEvidence: [],
    }
  }

  const useProjectConfig = hasProjectConfig(projectPath)

  if (!useProjectConfig && files.some(f => TS_EXTENSIONS.test(f))) {
    return {
      id: randomUUID(),
      attemptId,
      createdAt: new Date().toISOString(),
      status: 'SKIPPED',
      rawOutput:
        'TypeScript files detected but the project has no eslint.config.js. ' +
        'The built-in fallback linter only supports JavaScript. ' +
        'Add an eslint.config.js (or .mjs/.cjs) to the project so the harness can validate TypeScript files properly.',
      failureEvidence: [],
    }
  }

  const eslint = useProjectConfig
    ? new ESLint({ cwd: projectPath, warnIgnored: false })
    : new ESLint({
        cwd: projectPath,
        overrideConfigFile: true,
        warnIgnored: false,
        overrideConfig: [
          {
            ...js.configs.recommended,
            languageOptions: {
              globals: {
                ...globals.node,
                ...globals.browser,
              },
            },
          },
        ],
      })

  let rawResults: ESLint.LintResult[]

  try {
    rawResults = await eslint.lintFiles(files)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      id: randomUUID(),
      attemptId,
      createdAt: new Date().toISOString(),
      status: 'ERROR',
      rawOutput: message,
      failureEvidence: [],
    }
  }

  const failureEvidence: FailureEvidence[] = []

  for (const result of rawResults) {
    for (const msg of result.messages) {
      failureEvidence.push({
        id: randomUUID(),
        file: result.filePath,
        line: msg.line ?? 0,
        column: msg.column ?? 0,
        rule: msg.ruleId ?? 'parse-error',
        message: msg.message,
        severity: msg.severity === 2 ? 'error' : 'warning',
      })
    }
  }

  return {
    id: randomUUID(),
    attemptId,
    createdAt: new Date().toISOString(),
    status: failureEvidence.length === 0 ? 'PASS' : 'FAIL',
    rawOutput: JSON.stringify(rawResults),
    failureEvidence,
  }
}
