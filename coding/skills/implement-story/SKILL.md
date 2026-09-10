---
name: implement-story
description: Implement a user story with a governed control loop — Agent thinks, Harness controls, Graph explains.
---

## How to implement a user story

You are operating inside a governed control loop. Every action goes through the Harness tools — you cannot read files or write code directly. Follow the steps below **in order**. The Harness enforces state: out-of-order tool calls are rejected with a clear error.

Every tool call requires `sessionId`. Store it from Step 1 and pass it to every subsequent call.

---

### Step 1 — Create the session

Call `coding_create_session` with:
- `userStory`: the full text of the user story (or the file path to it)
- `scope`: array of folder or file paths the developer declared as modifiable

The Harness resolves scope paths to absolute paths and stores the session. Save the returned `sessionId`.

---

### Step 2 — Read the scope

Call `coding_read_scope` with `sessionId`.

The Harness walks every file inside the declared scope and returns their contents. Read them carefully — do not assume what files exist or what they contain. This is your only authorized window into the codebase.

---

### Step 3 — Submit your plan

Reason about the requirements against the files you read. Then call `coding_submit_plan` with:
- `sessionId`
- `reasoning`: a thorough explanation of what you understood and what you intend to do. This is stored permanently in the traceability graph.
- `filesConsidered`: list of absolute file paths you examined while forming the plan

---

### Step 4 — Propose changes

For **each file** you need to create, modify, or delete, call `coding_submit_proposed_change` with:
- `sessionId`
- `file`: absolute path (must be within scope — the Harness rejects anything else immediately)
- `operation`: `create`, `modify`, or `delete`
- `content`: the complete new content of the file (ignored for `delete`)
- `justification`: why this specific change implements the user story

Call this tool once per file. You may call it multiple times — each call accumulates into the same attempt.

---

### Step 5 — Request human approval

Present the proposed changes to the developer in plain language:
- List every file, its operation, and your justification
- Explain what the combined changes accomplish

Wait for the developer's explicit answer in the chat before proceeding.

Once they respond, call `coding_request_human_approval` with:
- `sessionId`
- `approved`: `true` if they approved, `false` if they rejected
- `notes`: any feedback they gave (optional)

If the result is `REJECTED`, stop. Do not start a new session without the developer's instruction.

---

### Step 6 — Apply changes

Call `coding_apply_changes` with `sessionId`.

The Harness re-validates scope for every file before writing anything. It also saves a backup of each file's original content before overwriting, enabling recovery if the session ends in `BUDGET_EXCEEDED`.

---

### Step 7 — Run verification

Call `coding_run_lint` with `sessionId`.

The Harness runs ESLint (using the project's own config if present, otherwise a bundled default). The result is one of:
- `DONE`: lint passed — the session is complete, trace saved to `.kiro/trace/`
- `CORRECTING`: lint failed, correction budget available — read the `failureEvidence` in the response
- `BUDGET_EXCEEDED`: lint failed, no more attempts — stop and inform the developer

---

### Step 8 — Correct and re-verify (only if `CORRECTING`)

Read the `failureEvidence` array returned by `run_lint`. Each entry contains:
- `file`: which file has the issue
- `line` / `column`: exact location
- `rule`: the ESLint rule that fired
- `message`: the violation description
- `severity`: `error` or `warning`

For each file that needs fixing, call `coding_submit_correction` with:
- `sessionId`
- `file`: absolute path of the file to correct
- `operation`: usually `modify`
- `content`: the **complete corrected** content of the file
- `justification`: what was wrong (reference the rule and line) and what you fixed

Call it once per file. Multiple calls accumulate into the same correction attempt.

Then **repeat from Step 6** (`apply_changes` → `run_lint`). The Harness tracks the attempt count — when the budget is exhausted it transitions to `BUDGET_EXCEEDED` and further corrections are rejected.

---

### Important rules

- **Never call `apply_changes` before `request_human_approval` returns `APPROVED`.** The Harness enforces this: the call will be rejected.
- **Never propose changes outside the declared scope.** The Harness validates paths at both `submit_proposed_change` and `apply_changes`.
- **Never attempt to modify the correction budget.** It is owned by the Harness and cannot be changed.
- **Never start a new session to escape a budget limit.** If `BUDGET_EXCEEDED`, stop and show the developer the `failureEvidence` history so they can intervene manually.
- **If a tool returns an error, read it in full.** It always contains the current session status and the exact reason for the rejection.
