import { ESLint } from 'eslint'
import js from '@eslint/js'
import globals from 'globals'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { FailureEvidence, VerificationResult } from '../domain/types.js'

const CONFIG_FILES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs']

function hasProjectConfig(workspacePath: string): boolean {
  return CONFIG_FILES.some(f => existsSync(join(workspacePath, f)))
}

export async function runLint(
  files: string[],
  attemptId: string,
  workspacePath: string
): Promise<VerificationResult> {
  if (files.length === 0) {
    return {
      id: randomUUID(),
      attemptId,
      createdAt: new Date().toISOString(),
      type: 'lint',
      status: 'SKIPPED',
      rawOutput: 'No files to lint (all changes are deletes).',
      failureEvidence: [],
    }
  }

  const useProjectConfig = hasProjectConfig(workspacePath)

  const eslint = useProjectConfig
    ? new ESLint({ cwd: workspacePath, warnIgnored: false })
    : new ESLint({
        cwd: workspacePath,
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
      type: 'lint',
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
    type: 'lint',
    status: failureEvidence.length === 0 ? 'PASS' : 'FAIL',
    rawOutput: JSON.stringify(rawResults),
    failureEvidence,
  }
}
