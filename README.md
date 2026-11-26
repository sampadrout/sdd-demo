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
| Role-based locators | `libs/ui-map/src/lib/parabank.roles.ts` (`cy.getByRole`) |
| Framework changes | `docs/framework-overview.md` |

Layering (only allowed direction):

```
Test → App Action → Selectors / UI → ParaBank
```

No Page Object Model. Tests call business intent (`transferFunds.transfer()`), not raw clicks.

## Quick start

One command after cloning, on macOS or Windows. The only thing you install yourself is [Node.js 22, 24, or 26+](https://nodejs.org/) (Cypress 16 does not support Node 20 or 25) (the installer includes npm).

```bash
npm run setup
```

That installs repo dependencies from `package.json`, the Cypress binary, the Cypress MCP server, Playwright Chromium, refreshes the OpenSpec skills, and creates your local `.env` from `.env.example` (gitignored; add your own keys there). Then reload Cursor and run the sample journey:

```bash
npm run cy:run
```

Open the runner:

```bash
npm run cy:open
```

Agent-driven runs (Cypress 16.4+): `npm run cy:agent` starts a headless `cypress open` session, then drive it with `npx cypress tap run <spec>`, `tap status`, `tap reporter`, `tap aria` (or `npm run cy:tap -- <subcommand>`). `/auto-heal` uses this.

Framework design, how each Cypress feature is used, and the framework change log (including whether we are on the latest Cypress) live in [`docs/framework-overview.md`](docs/framework-overview.md).

## CI

GitHub Actions runs the ParaBank journey on every push to `main` and on demand:

- Workflow: `.github/workflows/cypress.yml`
- Manual run: **Actions → Cypress → Run workflow**
- Target: `https://parabank.parasoft.com/parabank` (`CYPRESS_BASE_URL`)
- Parallel: a `discover` job lists every `cypress/e2e/**/*.cy.ts` file, then one `e2e` job runs per spec at the same time (see [Parallel runs](#parallel-runs))

```bash
npm ci
npx cypress install
npm run cy:run
```

## Sample journey ([SDD-1](https://sampadrout.atlassian.net/browse/SDD-1))

Jira project **sdd-demo** (`SDD`) on https://sampadrout.atlassian.net holds the requirements.

`S-1–S-4` registers a unique customer (Faker), opens **Transfer Funds**, submits a transfer, and asserts **Transfer Complete!** — tagged `@jira SDD-1` in `cypress/e2e/transfer-funds.cy.ts`.

Demo intake: `/from-jira SDD-1`

**Also automated:** [SDD-2](https://sampadrout.atlassian.net/browse/SDD-2) — Request Loan journey (`cypress/e2e/request-loan.cy.ts`).

**Practice ticket (not yet automated):** [SDD-3](https://sampadrout.atlassian.net/browse/SDD-3) — Bill Pay journey (`docs/jira/SDD-3-bill-pay.md`).

## OpenSpec / SDD commands (Cursor)

| Command | Purpose |
|---|---|
| `/from-jira SDD-3` | Intake — fetch ticket → OpenSpec change + `S-<n>` |
| `/discover-selectors /billpay.htm "Bill Pay form"` | Live DOM discovery → `libs/ui-map` |
| `/openspec-propose` | (Optional) invent a change without Jira |
| `/openspec-apply-change` | Implement App Actions + journey test |
| `/auto-heal` | Optional — heal failing journey after apply / on Cypress failure |
| `/openspec-archive-change` | Merge specs into `openspec/specs/` |
| `/openspec-explore` | Think through unclear requirements |
| `/repo-context` | Pack repo into `repomix-output.md` for cheaper agent orientation |

Suggested flow for SDD-3:

```text
/from-jira SDD-3
/discover-selectors /billpay.htm "payee details, amount, from account, submit"
/openspec-apply-change
npm run cy:run -- --spec cypress/e2e/bill-pay.cy.ts
# if red: /auto-heal   (or /auto-heal cypress/e2e/bill-pay.cy.ts)
/openspec-archive-change
```

Cursor rules: `.cursor/rules/spec-driven.mdc`. Skills: `.agents/skills/openspec-*` (OpenSpec 2.x). Commands: `.cursor/commands/`.

### Repo context (Repomix)

To cut agent token use, pack the useful parts of the repo into one file:

```bash
npm run context            # → repomix-output.md
npm run context:compress   # smaller (structure-focused)
```

Or in Cursor: `/repo-context`. Config: `repomix.config.json` (ignores `node_modules`, lockfile, archived changes, screenshots). Output is gitignored.

**`/from-jira` and `/auto-heal` always regenerate the pack** (`npm run context`) first, so intake and pipeline heal runs use fresh repo details without re-scanning the tree. Use `/repo-context` for ad-hoc regenerates mid-flow.

### Cypress MCP

`npm run setup` builds this for you. The server lives at `tools/cypress-mcp/` and `.cursor/mcp.json` starts `${workspaceFolder}/tools/cypress-mcp/dist/server.js`.

```bash
npm run mcp:setup   # MCP only: install, build, Playwright Chromium
npm run mcp:build   # rebuild after editing tools/cypress-mcp/src
```

Then reload Cursor MCP / the window. See `tools/cypress-mcp/README.md` for the tool reference.

## Why ParaBank?

Public, always-on bank demo with real multi-step journeys (login → transfer → confirmation) that map cleanly to ticket ACs — without VPN or product credentials.

## How to run single cypress test in local

```bash
npx cypress open --e2e --browser chrome
```

## Parallel runs

Each spec file under `cypress/e2e/` runs in its own Cypress process, and several run at once. Specs are discovered automatically, so a new `*.cy.ts` file is picked up with no config change.

### Locally

```bash
npm run cy:run:parallel                       # up to 4 workers (capped at your CPU count)
npm run cy:run:parallel -- --workers=2        # set the number of workers
npm run cy:run:parallel -- --browser=chrome   # browser (default: chrome)
```

`scripts/cy-parallel.mjs` runs the specs through a queue of workers. Each spec's output prints as one block, so logs from different specs don't interleave. At the end it prints a pass/fail summary and exits non-zero if any spec failed.

The regular `npm run cy:run` still runs every spec in one process.

### In CI

`.github/workflows/cypress.yml` runs in two stages:

1. **`discover`** finds all `cypress/e2e/**/*.cy.ts` files and passes the list on as a job matrix.
2. **`e2e`** runs one job per spec, all at the same time. `fail-fast` is off, so one failing spec does not cancel the others.

Screenshots from a failed run are uploaded as `cypress-screenshots-<index>`, one artifact per job, kept for 7 days.

### Adding a spec

Add a file ending in `.cy.ts` under `cypress/e2e/`. It is picked up by both the local script and the CI matrix on the next run.

Specs must not depend on each other or on a shared user. Each journey registers its own user with a timestamp and random suffix, so parallel runs don't collide on ParaBank's shared demo database.