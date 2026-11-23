# /from-jira — Scaffold an OpenSpec change from a Jira ticket

**Usage:** `/from-jira <TICKET-KEY>`  
**Examples:** `/from-jira SDD-1` · `/from-jira SDD-2`

Intake step of the SDD workflow (see `.cursor/rules/spec-driven.mdc`).

## Agent instructions

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

### Step 3 — Capability
Reuse an existing `openspec/specs/<capability>/` folder when the ticket fits; only create a new capability for a new product area (e.g. `request-loan`, `transfer-funds`).

### Step 4 — Scaffold
```bash
npx openspec new change "<kebab-name-from-ticket>"
```
Fill proposal / design / specs / tasks (OpenSpec instructions). Design must note discovery pages and reuse of existing App Actions (`auth`, `accounts`, …).

### Step 5 — Hand off
Next: `/discover-selectors …` → `/opsx:apply` → run Cypress → `/opsx:archive`.
