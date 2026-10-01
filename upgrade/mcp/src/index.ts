import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createContext } from './context.js'
import { handleCreateSession, createSessionToolDefinition } from './tools/create-session.js'
import { handleReadProject, readProjectToolDefinition } from './tools/read-project.js'
import { handleSubmitThink, submitThinkToolDefinition } from './tools/submit-think.js'
import { handleSubmitIssue, submitIssueToolDefinition } from './tools/submit-issue.js'
import { handleSubmitPlan, submitPlanToolDefinition } from './tools/submit-plan.js'
import { handleRequestPlanApproval, requestPlanApprovalToolDefinition } from './tools/request-plan-approval.js'
import { handleReadAnalysis, readAnalysisToolDefinition } from './tools/read-analysis.js'
import { handleSubmitFileChange, submitFileChangeToolDefinition } from './tools/submit-file-change.js'
import { handleApplyChanges, applyChangesToolDefinition } from './tools/apply-changes.js'
import { handleRunValidation, runValidationToolDefinition } from './tools/run-validation.js'
import { handleSubmitCorrection, submitCorrectionToolDefinition } from './tools/submit-correction.js'
import { handleFailSession, failSessionToolDefinition } from './tools/fail-session.js'
import { handleGenerateReport, generateReportToolDefinition } from './tools/generate-report.js'

const ctx = createContext()

const server = new Server(
  { name: 'upgrade', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    createSessionToolDefinition,
    readProjectToolDefinition,
    submitThinkToolDefinition,
    submitIssueToolDefinition,
    submitPlanToolDefinition,
    requestPlanApprovalToolDefinition,
    readAnalysisToolDefinition,
    submitFileChangeToolDefinition,
    applyChangesToolDefinition,
    runValidationToolDefinition,
    submitCorrectionToolDefinition,
    failSessionToolDefinition,
    generateReportToolDefinition,
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    let result: unknown
    const a = (args ?? {}) as unknown

    switch (name) {
      case 'upgrade_create_session':
        result = await handleCreateSession(a as Parameters<typeof handleCreateSession>[0], ctx)
        break
      case 'upgrade_read_project':
        result = await handleReadProject(a as Parameters<typeof handleReadProject>[0], ctx)
        break
      case 'upgrade_submit_think':
        result = await handleSubmitThink(a as Parameters<typeof handleSubmitThink>[0], ctx)
        break
      case 'upgrade_submit_issue':
        result = await handleSubmitIssue(a as Parameters<typeof handleSubmitIssue>[0], ctx)
        break
      case 'upgrade_submit_plan':
        result = await handleSubmitPlan(a as Parameters<typeof handleSubmitPlan>[0], ctx)
        break
      case 'upgrade_request_plan_approval':
        result = await handleRequestPlanApproval(a as Parameters<typeof handleRequestPlanApproval>[0], ctx)
        break
      case 'upgrade_read_analysis':
        result = await handleReadAnalysis(a as Parameters<typeof handleReadAnalysis>[0], ctx)
        break
      case 'upgrade_submit_file_change':
        result = await handleSubmitFileChange(a as Parameters<typeof handleSubmitFileChange>[0], ctx)
        break
      case 'upgrade_apply_changes':
        result = await handleApplyChanges(a as Parameters<typeof handleApplyChanges>[0], ctx)
        break
      case 'upgrade_run_validation':
        result = await handleRunValidation(a as Parameters<typeof handleRunValidation>[0], ctx)
        break
      case 'upgrade_submit_correction':
        result = await handleSubmitCorrection(a as Parameters<typeof handleSubmitCorrection>[0], ctx)
        break
      case 'upgrade_fail_session':
        result = await handleFailSession(a as Parameters<typeof handleFailSession>[0], ctx)
        break
      case 'upgrade_generate_report':
        result = await handleGenerateReport(a as Parameters<typeof handleGenerateReport>[0], ctx)
        break
      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      isError: true,
      content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    }
  }
})

const transport = new StdioServerTransport();
(async () => { await server.connect(transport) })().catch(console.error)
