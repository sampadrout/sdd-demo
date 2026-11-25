# /from-jira — Scaffold an OpenSpec change from a Jira ticket

**Usage:** `/from-jira <TICKET-KEY>`  
**Examples:** `/from-jira SDD-1` · `/from-jira SDD-2`

Intake step of the SDD workflow (see `.cursor/rules/spec-driven.mdc`).

## Agent instructions

### Step 0 — Refresh repo context (always)
**Every** `/from-jira` run must regenerate the Repomix pack so orientation is not stale:

```bash
npm run context
```

Then **read** `repomix-output.md` once before mapping the ticket (App Actions, ui-map, existing OpenSpec capabilities, commands). Prefer that pack over broad Glob/Grep for layout. Announce the pack summary (file/token counts from the CLI).

If `npm run context` fails, stop and report the error — do not scaffold on a guessed repo shape.

### Step 1 — Fetch the ticket
Call Atlassian MCP `getJiraIssue` with:
- `issueIdOrKey`: `<TICKET-KEY>`
- `responseContentFormat`: `markdown`

Extract summary, description, acceptance criteria.  
If MCP is unauthenticated, stop and ask the engineer to connect Atlassian MCP (or paste the ticket body).

> Jira ACs are usually prose — that is expected. Translate into WHEN/THEN in the OpenSpec delta; do not require Gherkin on the ticket.

### Step 2 — Map to S-requirements
For each automatable behavior → `S-<n>`. Flag non-automatable as `[MANUAL]`.  
Classify as **journey** (one `it` spanning S-range) vs **facets** (separate `it`s + `beforeEach`).  
Use the fresh `repomix-output.md` to reuse existing capabilities / App Actions instead of inventing duplicates.

### Step 3 — Capability
Reuse an existing `openspec/specs/<capability>/` folder when the ticket fits; only create a new capability for a new product area (e.g. `request-loan`, `transfer-funds`).

### Step 4 — Scaffold
```bash
npx openspec new change "<kebab-name-from-ticket>"
```
Fill proposal / design / specs / tasks (OpenSpec instructions). Design must note discovery pages and reuse of existing App Actions (`auth`, `accounts`, …).

### Step 5 — Hand off
Next: `/discover-selectors …` → `/openspec-apply-change` → run Cypress → optional `/auto-heal` on failure → `/openspec-archive-change`.  
(Optional: `/repo-context` again after apply if you want the pack to include the new change artifacts.)
