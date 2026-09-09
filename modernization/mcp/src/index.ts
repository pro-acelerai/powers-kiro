import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createContext } from './context.js'
import { handleCreateSession, createSessionToolDefinition } from './tools/create-session.js'
import { handleReadLegacy, readLegacyToolDefinition } from './tools/read-legacy.js'
import { handleSubmitThink, submitThinkToolDefinition } from './tools/submit-think.js'
import { handleSubmitFinding, submitFindingToolDefinition } from './tools/submit-finding.js'
import { handleRequestTriage, requestTriageToolDefinition } from './tools/request-triage.js'
import { handleSubmitTriageDecisions, submitTriageDecisionsToolDefinition } from './tools/submit-triage-decisions.js'
import { handleSubmitSpecification, submitSpecificationToolDefinition } from './tools/submit-specification.js'
import { handleRequestSpecApproval, requestSpecApprovalToolDefinition } from './tools/request-spec-approval.js'
import { handleReadDiscovery, readDiscoveryToolDefinition } from './tools/read-discovery.js'
import { handleSubmitMigrationPlan, submitMigrationPlanToolDefinition } from './tools/submit-migration-plan.js'
import { handleRequestPlanApproval, requestPlanApprovalToolDefinition } from './tools/request-plan-approval.js'
import { handleReadPhaseContext, readPhaseContextToolDefinition } from './tools/read-phase-context.js'
import { handleSubmitNewFile, submitNewFileToolDefinition } from './tools/submit-new-file.js'
import { handleApplyNewProject, applyNewProjectToolDefinition } from './tools/apply-new-project.js'
import { handleRunLint, runLintToolDefinition } from './tools/run-lint.js'
import { handleSubmitCorrection, submitCorrectionToolDefinition } from './tools/submit-correction.js'
import { handleGenerateReport, generateReportToolDefinition } from './tools/generate-report.js'
import { handleFailSession, failSessionToolDefinition } from './tools/fail-session.js'
import { handleGenerateDiscoveryHtml, generateDiscoveryHtmlToolDefinition } from './tools/generate-discovery-html.js'

const ctx = createContext()

const server = new Server(
  { name: 'modernization', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Session management (all phases)
    createSessionToolDefinition,
    // Phase 1: Discovery
    readLegacyToolDefinition,
    submitThinkToolDefinition,
    submitFindingToolDefinition,
    requestTriageToolDefinition,
    submitTriageDecisionsToolDefinition,
    submitSpecificationToolDefinition,
    requestSpecApprovalToolDefinition,
    // Phase 2: Architecture
    readDiscoveryToolDefinition,
    submitMigrationPlanToolDefinition,
    requestPlanApprovalToolDefinition,
    // Phase 3: Implementation
    readPhaseContextToolDefinition,
    submitNewFileToolDefinition,
    applyNewProjectToolDefinition,
    runLintToolDefinition,
    submitCorrectionToolDefinition,
    // Phase 4: Delivery
    generateReportToolDefinition,
    // Session lifecycle
    failSessionToolDefinition,
    // Reports
    generateDiscoveryHtmlToolDefinition,
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    let result: unknown
    const a = (args ?? {}) as unknown

    switch (name) {
      case 'modernization_create_session':
        result = await handleCreateSession(a as Parameters<typeof handleCreateSession>[0], ctx)
        break
      case 'modernization_read_legacy':
        result = await handleReadLegacy(a as Parameters<typeof handleReadLegacy>[0], ctx)
        break
      case 'modernization_submit_think':
        result = await handleSubmitThink(a as Parameters<typeof handleSubmitThink>[0], ctx)
        break
      case 'modernization_submit_finding':
        result = await handleSubmitFinding(a as Parameters<typeof handleSubmitFinding>[0], ctx)
        break
      case 'modernization_request_triage':
        result = await handleRequestTriage(a as Parameters<typeof handleRequestTriage>[0], ctx)
        break
      case 'modernization_submit_triage_decisions':
        result = await handleSubmitTriageDecisions(a as Parameters<typeof handleSubmitTriageDecisions>[0], ctx)
        break
      case 'modernization_submit_specification':
        result = await handleSubmitSpecification(a as Parameters<typeof handleSubmitSpecification>[0], ctx)
        break
      case 'modernization_request_spec_approval':
        result = await handleRequestSpecApproval(a as Parameters<typeof handleRequestSpecApproval>[0], ctx)
        break
      case 'modernization_read_discovery':
        result = await handleReadDiscovery(a as Parameters<typeof handleReadDiscovery>[0], ctx)
        break
      case 'modernization_submit_migration_plan':
        result = await handleSubmitMigrationPlan(a as Parameters<typeof handleSubmitMigrationPlan>[0], ctx)
        break
      case 'modernization_request_plan_approval':
        result = await handleRequestPlanApproval(a as Parameters<typeof handleRequestPlanApproval>[0], ctx)
        break
      case 'modernization_read_phase_context':
        result = await handleReadPhaseContext(a as Parameters<typeof handleReadPhaseContext>[0], ctx)
        break
      case 'modernization_submit_new_file':
        result = await handleSubmitNewFile(a as Parameters<typeof handleSubmitNewFile>[0], ctx)
        break
      case 'modernization_apply_new_project':
        result = await handleApplyNewProject(a as Parameters<typeof handleApplyNewProject>[0], ctx)
        break
      case 'modernization_run_lint':
        result = await handleRunLint(a as Parameters<typeof handleRunLint>[0], ctx)
        break
      case 'modernization_submit_correction':
        result = await handleSubmitCorrection(a as Parameters<typeof handleSubmitCorrection>[0], ctx)
        break
      case 'modernization_generate_report':
        result = await handleGenerateReport(a as Parameters<typeof handleGenerateReport>[0], ctx)
        break
      case 'modernization_fail_session':
        result = await handleFailSession(a as Parameters<typeof handleFailSession>[0], ctx)
        break
      case 'modernization_generate_discovery_html':
        result = await handleGenerateDiscoveryHtml(a as Parameters<typeof handleGenerateDiscoveryHtml>[0], ctx)
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
