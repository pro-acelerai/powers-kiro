import { ESLint } from 'eslint'
import js from '@eslint/js'
import globals from 'globals'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { FailureEvidence, VerificationResult } from '../domain/types.js'

const CONFIG_FILES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs']
const TS_EXTENSIONS = /\.[mc]?tsx?$/i

function hasProjectConfig(projectPath: string): boolean {
  return CONFIG_FILES.some(f => existsSync(join(projectPath, f)))
}

export async function runLint(
  files: string[],
  attemptId: string,
  projectPath: string
): Promise<VerificationResult> {
  if (files.length === 0) {
    return {
      id: randomUUID(),
      attemptId,
      createdAt: new Date().toISOString(),
      type: 'lint',
      status: 'SKIPPED',
      rawOutput: 'No files to lint.',
      failureEvidence: [],
    }
  }

  const useProjectConfig = hasProjectConfig(projectPath)

  // Without a project ESLint config the built-in fallback only covers JS.
  // TypeScript files require a @typescript-eslint/parser — skip them and ask
  // the agent to include an eslint.config.js in the new project.
  if (!useProjectConfig && files.some(f => TS_EXTENSIONS.test(f))) {
    return {
      id: randomUUID(),
      attemptId,
      createdAt: new Date().toISOString(),
      type: 'lint',
      status: 'SKIPPED',
      rawOutput:
        'TypeScript files detected but the new project has no eslint.config.js. ' +
        'The built-in fallback linter only supports JavaScript. ' +
        'Add an eslint.config.js (or .mjs/.cjs) to the new project so the harness can validate TypeScript files properly. ' +
        'Tip: include it as one of the files submitted via submit_new_file.',
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
