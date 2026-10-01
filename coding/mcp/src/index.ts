import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createContext } from './context.js'
import { handleCreateSession, createSessionToolDefinition } from './tools/create-session.js'
import { handleReadScope, readScopeToolDefinition } from './tools/read-scope.js'
import { handleApplyChanges, applyChangesToolDefinition } from './tools/apply-changes.js'
import { handleSubmitPlan, submitPlanToolDefinition } from './tools/submit-plan.js'
import { handleSubmitProposedChange, submitProposedChangeToolDefinition } from './tools/submit-proposed-change.js'
import { handleRequestHumanApproval, requestHumanApprovalToolDefinition } from './tools/request-human-approval.js'
import { handleRunLint, runLintToolDefinition } from './tools/run-lint.js'
import { handleSubmitCorrection, submitCorrectionToolDefinition } from './tools/submit-correction.js'

const ctx = createContext()

const server = new Server(
  { name: 'coding', version: '0.2.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    createSessionToolDefinition,
    readScopeToolDefinition,
    submitPlanToolDefinition,
    submitProposedChangeToolDefinition,
    requestHumanApprovalToolDefinition,
    applyChangesToolDefinition,
    runLintToolDefinition,
    submitCorrectionToolDefinition,
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    let result: unknown
    // MCP SDK types args as Record<string,unknown>|undefined — cast through unknown for each handler
    const a = (args ?? {}) as unknown

    switch (name) {
      case 'coding_create_session':
        result = await handleCreateSession(a as Parameters<typeof handleCreateSession>[0], ctx)
        break
      case 'coding_read_scope':
        result = await handleReadScope(a as Parameters<typeof handleReadScope>[0], ctx)
        break
      case 'coding_submit_plan':
        result = await handleSubmitPlan(a as Parameters<typeof handleSubmitPlan>[0], ctx)
        break
      case 'coding_submit_proposed_change':
        result = await handleSubmitProposedChange(a as Parameters<typeof handleSubmitProposedChange>[0], ctx)
        break
      case 'coding_request_human_approval':
        result = await handleRequestHumanApproval(a as Parameters<typeof handleRequestHumanApproval>[0], ctx)
        break
      case 'coding_apply_changes':
        result = await handleApplyChanges(a as Parameters<typeof handleApplyChanges>[0], ctx)
        break
      case 'coding_run_lint':
        result = await handleRunLint(a as Parameters<typeof handleRunLint>[0], ctx)
        break
      case 'coding_submit_correction':
        result = await handleSubmitCorrection(a as Parameters<typeof handleSubmitCorrection>[0], ctx)
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
