# sdd-demo

Spec-Driven Development (SDD) demo suite: **OpenSpec + Cypress App Actions** against [ParaBank](https://parabank.parasoft.com/parabank).

This is a slim showcase derived from the PlatformTests SDD constitution — not a fork of the Extreme Reach product suite.

## What it demonstrates

| Stage | Artefact |
|---|---|
| Requirements | `openspec/specs/transfer-funds/spec.md` (`S-1`–`S-4`) |
| Change archive | `openspec/changes/archive/2026-11-23-parabank-transfer-funds/` |
| Selectors | `libs/ui-map/src/lib/parabank.selectors.ts` |
| App Actions | `libs/actions/src/lib/features/{auth,accounts,transfer-funds}/` |
| Journey test | `cypress/e2e/transfer-funds.cy.ts` |

Layering (only allowed direction):

```
Test → App Action → Selectors / UI → ParaBank
```

No Page Object Model. Tests call business intent (`transferFunds.transfer()`), not raw clicks.

## Quick start

```bash
npm ci
npx cypress install
npm run cy:run
```

Open the runner:

```bash
npm run cy:open
```

## CI

GitHub Actions runs the ParaBank journey on every push to `main` and on demand:

- Workflow: `.github/workflows/cypress.yml`
- Manual run: **Actions → Cypress → Run workflow**
- Target: `https://parabank.parasoft.com/parabank` (`CYPRESS_BASE_URL`)

```bash
npm ci
npx cypress install
npm run cy:run
```

## Sample journey ([SDD-1](https://sampadrout.atlassian.net/browse/SDD-1))

Jira project **sdd-demo** (`SDD`) on https://sampadrout.atlassian.net holds the requirements.

`S-1–S-4` registers a unique customer (Faker), opens **Transfer Funds**, submits a transfer, and asserts **Transfer Complete!** — tagged `@jira SDD-1` in `cypress/e2e/transfer-funds.cy.ts`.

Demo intake: `/from-jira SDD-1`

**Practice ticket (not yet automated):** [SDD-2](https://sampadrout.atlassian.net/browse/SDD-2) — Request Loan journey.

## OpenSpec / SDD commands (Cursor)

| Command | Purpose |
|---|---|
| `/from-jira SDD-2` | Intake — fetch ticket → OpenSpec change + `S-<n>` |
| `/discover-selectors /requestloan.htm "Request Loan form"` | Live DOM discovery → `libs/ui-map` |
| `/openspec-propose` | (Optional) invent a change without Jira |
| `/openspec-apply-change` | Implement App Actions + journey test |
| `/auto-heal` | Optional — heal failing journey after apply / on Cypress failure |
| `/openspec-archive-change` | Merge specs into `openspec/specs/` |
| `/openspec-explore` | Think through unclear requirements |
| `/repo-context` | Pack repo into `repomix-output.md` for cheaper agent orientation |

Suggested flow for SDD-2:

```text
/from-jira SDD-2
/discover-selectors /requestloan.htm "loan amount, down payment, from account, submit"
/openspec-apply-change
npm run cy:run -- --spec cypress/e2e/request-loan.cy.ts
# if red: /auto-heal   (or /auto-heal cypress/e2e/request-loan.cy.ts)
/openspec-archive-change
```

Cursor rules: `.cursor/rules/spec-driven.mdc`. Skills: `.agents/skills/openspec-*` (OpenSpec 2.x; replaces the old `/opsx:*` commands). Commands: `.cursor/commands/`.

### Repo context (Repomix)

To cut agent token use, pack the useful parts of the repo into one file:

```bash
npm run context            # → repomix-output.md
npm run context:compress   # smaller (structure-focused)
```

Or in Cursor: `/repo-context`. Config: `repomix.config.json` (ignores `node_modules`, lockfile, archived changes, screenshots). Output is gitignored.

**`/from-jira` and `/auto-heal` always regenerate the pack** (`npm run context`) first, so intake and pipeline heal runs use fresh repo details without re-scanning the tree. Use `/repo-context` for ad-hoc regenerates mid-flow.

### Cypress MCP

`.cursor/mcp.json` points at the local Cypress MCP (not an npm package):

```text
/Users/sampadrout/Documents/Cypress_MCP/dist/server.js
```

If MCP fails to start, confirm that path exists, then reload Cursor MCP / the window.


## Why ParaBank?

Public, always-on bank demo with real multi-step journeys (login → transfer → confirmation) that map cleanly to ticket ACs — without VPN or product credentials.
