import { randomUUID } from 'node:crypto'
import { runLint } from '../harness/lint-runner.js'
import { runValidationCommand } from '../harness/validation-runner.js'
import { transition, canAttemptCorrection } from '../domain/state-machine.js'
import type { AppContext } from '../context.js'
import type { ExecutionSession, ValidationResult, Resolution, VerificationStatus } from '../domain/types.js'
import { getCurrentAttempt } from './attempt-utils.js'

export async function handleRunValidation(args: { sessionId: string }, ctx: AppContext) {
  const session = await ctx.store.load(args.sessionId)

  if (session.type !== 'execution') {
    throw new Error(`upgrade_run_validation requires an execution session, got ${session.type}`)
  }

  if (session.status !== 'APPLYING') {
    throw new Error(`upgrade_run_validation requires status APPLYING, got ${session.status}`)
  }

  const exec = session as ExecutionSession
  const attempt = getCurrentAttempt(exec)

  if (!attempt) {
    throw new Error('No IN_PROGRESS attempt found. Apply changes first via upgrade_apply_changes.')
  }

  // Transition to VALIDATING first
  const toValidating = transition(session, 'VALIDATING')
  if (!toValidating.ok) throw new Error(toValidating.error)

  const now = new Date().toISOString()

  // Run lint on JS/TS files
  const filesToLint = attempt.fileChanges
    .filter(fc => fc.operation !== 'delete')
    .map(fc => fc.file)
    .filter(f => /\.[jt]sx?$/.test(f))

  const lintResult = await runLint(filesToLint, attempt.id, exec.projectPath)

  // Run validation command
  let commandStatus: VerificationStatus = 'SKIPPED'
  let rawCommandOutput = 'No validation command configured.'

  if (exec.validationCommand?.trim()) {
    const cmdResult = await runValidationCommand(exec.validationCommand.trim(), exec.projectPath)
    commandStatus = cmdResult.status === 'PASS' ? 'PASS'
      : cmdResult.status === 'FAIL' ? 'FAIL'
      : 'ERROR'
    rawCommandOutput = cmdResult.output
  }

  // Overall status: PASS only if both pass; SKIPPED if no files and no command
  let overallPass: boolean
  const lintOk = lintResult.status === 'PASS' || lintResult.status === 'SKIPPED'
  const cmdOk = commandStatus === 'PASS' || commandStatus === 'SKIPPED'

  if (lintResult.status === 'SKIPPED' && commandStatus === 'SKIPPED') {
    overallPass = true
  } else {
    overallPass = lintOk && cmdOk
  }

  const validationResult: ValidationResult = {
    id: randomUUID(),
    attemptId: attempt.id,
    createdAt: now,
    lintStatus: lintResult.status,
    commandStatus,
    rawLintOutput: lintResult.rawOutput,
    rawCommandOutput,
    validationCommand: exec.validationCommand || null,
    failureEvidence: lintResult.failureEvidence,
  }

  // Complete the attempt
  const completedAttempt = {
    ...attempt,
    completedAt: now,
    status: 'COMPLETED' as const,
    validationResult,
  }

  const otherAttempts = exec.attempts.filter(a => a.id !== attempt.id)
  const allAttempts = [...otherAttempts, completedAttempt]

  if (overallPass) {
    const toDone = transition(toValidating.session, 'DONE')
    if (!toDone.ok) throw new Error(toDone.error)

    const resolution: Resolution = {
      id: randomUUID(),
      sessionId: args.sessionId,
      resolvedAt: now,
      outcome: 'DONE',
    }

    const updated = {
      ...toDone.session,
      attempts: allAttempts,
      resolution,
    } as ExecutionSession
    await ctx.store.save(updated, session)

    return {
      sessionId: session.id,
      status: 'DONE',
      lintStatus: lintResult.status,
      commandStatus,
      attemptNumber: completedAttempt.attemptNumber,
      message: 'Validation passed. Upgrade execution is DONE. Call upgrade_generate_report to produce the final report.',
    }
  }

  // Validation failed
  const tempSession = { ...toValidating.session, attempts: allAttempts } as ExecutionSession

  if (!canAttemptCorrection(tempSession)) {
    const toBudget = transition(toValidating.session, 'BUDGET_EXCEEDED')
    if (!toBudget.ok) throw new Error(toBudget.error)

    const resolution: Resolution = {
      id: randomUUID(),
      sessionId: args.sessionId,
      resolvedAt: now,
      outcome: 'BUDGET_EXCEEDED',
    }

    const updated = {
      ...toBudget.session,
      attempts: allAttempts,
      resolution,
    } as ExecutionSession
    await ctx.store.save(updated, session)

    return {
      sessionId: session.id,
      status: 'BUDGET_EXCEEDED',
      lintStatus: lintResult.status,
      commandStatus,
      attemptsUsed: allAttempts.length,
      correctionBudget: exec.correctionBudget,
      failureEvidence: lintResult.failureEvidence,
      rawCommandOutput,
      message: 'Validation failed and correction budget exhausted. Session ended as BUDGET_EXCEEDED.',
    }
  }

  // Can correct
  const toCorrection = transition(toValidating.session, 'CORRECTING')
  if (!toCorrection.ok) throw new Error(toCorrection.error)

  const updated = { ...toCorrection.session, attempts: allAttempts } as ExecutionSession
  await ctx.store.save(updated, session)

  return {
    sessionId: session.id,
    status: 'CORRECTING',
    lintStatus: lintResult.status,
    commandStatus,
    attemptNumber: completedAttempt.attemptNumber,
    attemptsRemaining: exec.correctionBudget - allAttempts.length,
    failureEvidence: lintResult.failureEvidence,
    rawCommandOutput,
    message:
      `Validation failed. ` +
      `${exec.correctionBudget - allAttempts.length} correction attempt(s) remaining. ` +
      `Call upgrade_submit_correction, then upgrade_submit_file_change and upgrade_apply_changes + upgrade_run_validation again.`,
  }
}

export const runValidationToolDefinition = {
  name: 'upgrade_run_validation',
  description:
    'Run validation (lint + user-configured command) on the upgraded project. ' +
    'If validation passes: session transitions to DONE. ' +
    'If validation fails: session transitions to CORRECTING for another attempt (up to 3 total). ' +
    'If correction budget exhausted: session transitions to BUDGET_EXCEEDED.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sessionId: { type: 'string', description: 'The execution session ID' },
    },
    required: ['sessionId'],
  },
}
