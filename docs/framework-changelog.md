# Framework changelog

A running log of **framework-level** changes: Cypress upgrades and the features we adopt from them, tooling, conventions, CI, and agent workflows. It does not cover individual journeys or tickets (those live in `openspec/`).

**How to use this file**
- Newest entry first. Add an entry whenever the framework changes (Cypress/Node bump, new convention, new script, CI change).
- Each entry says **what changed**, **why**, **where in the repo**, and **how it was verified**.
- The status table below is the quick answer to "are we up to date?". Update it with every Cypress bump.

## Current status

| Item | Value | Last checked |
|---|---|---|
| Cypress (`package.json` / installed) | `^16.4.0` / `16.4.0` (npm `latest`) | 2026-11-26 |
| Supported Node.js | 22.x, 24.x, 26+ (Cypress 16 dropped Node 20 and 25) | 2026-11-26 |
| CI Node | 22 (`.github/workflows/cypress.yml`) | 2026-11-26 |
| CI actions | `cypress-io/github-action@v7`, `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7` | 2026-11-26 |
| Retries | `runMode: 1`, `openMode: 0` (`cypress.config.ts`) | 2026-11-26 |
| Cypress release notes | https://docs.cypress.io/app/references/changelog | 2026-11-26 |

**Checking for a new release**

```bash
npm view cypress version dist-tags   # compare with package.json
npx cypress --version
```

After a bump: `npm install`, `npm run cy:run`, then add an entry below and update the table.

## Backlog (known Cypress features not yet adopted)

| Feature | Cypress | Idea |
|---|---|---|
| `cy.session()` in `transfer-funds` | 12+ | Not used there: its S-1 requires registration, so it must register in the test. Revisit if a shared-customer spec appears |
| `cy.getByRole()` for headings and labelled fields | 16.2.0 | ParaBank inputs have no labels today; revisit if markup changes |
| Replace parts of `tools/cypress-mcp` with `cypress tap` | 16.4.0 | Evaluate overlap (run, failures, DOM/ARIA inspection) |
| `trustedCertificates` | 16.1.0 | Only if we point at a self-signed environment |

---

## 2026-11-26 — Session reuse, run-mode retries, CI action upgrades

**Cypress:** `16.4.0` (no version bump).

### 4. `cy.session()` for authenticated setup
- **Why:** `request-loan` registers a customer only as setup (its `S-1`–`S-4` start at "open Request Loan"). Registration took ~5s; restoring a cached session took ~0.5s in a probe.
- **Change:**
  - `auth.session(customer)` in `libs/actions/src/lib/features/auth/main.ts` wraps `cy.session(['parabank', username], register…, { cacheAcrossSpecs: true, validate })`, then visits `/overview.htm`. `validate` calls `cy.request('/overview.htm')` and requires the "Accounts Overview" text, so a dead server session is recreated.
  - `request-loan.cy.ts` builds its customer once at `describe` level (not per attempt) and calls `auth.session(customer)`, so a retry restores the session instead of registering again.
  - `transfer-funds.cy.ts` is unchanged: its `S-1` is registration, so it keeps calling `auth.register()` directly.
- **Convention:** use `auth.session()` when registration/login is setup; use `auth.register()` / `auth.login()` when it is the behaviour under test.
- **Limits:** the session cache lives in one Cypress process. Parallel runs (`cy:run:parallel`, one CI job per spec) do not share it.
- **Verified:** both specs pass; temporary probe confirmed a second `auth.session()` call restored the session (0.5s vs 5.3s) and that an unauthenticated `/overview.htm` lacks the validate marker (probe deleted).

### 5. Run-mode retries
- **Why:** ParaBank is a shared public demo and occasionally flaky.
- **Change:** `retries: { runMode: 1, openMode: 0 }` in `cypress.config.ts`. `cypress open` and `tap` sessions never retry, so local/agent failures stay visible and `/auto-heal` triage is not masked.
- **Left unchanged:** `defaultCommandTimeout: 15000` and the other timeouts. `keystrokeDelay` stays at the Cypress 16 default of `0`; set it to `10` only if typing becomes flaky.
- **Caveat:** a test that passes on retry is still reported as passed. Watch for repeated retries in CI logs as a flake signal.

### 6. CI: Node 24-based actions
- **Why:** `cypress-io/github-action@v6` runs on Node 20 and is deprecated as of v7.0.0 (Node 24). The other actions had v7 majors.
- **Change:** `.github/workflows/cypress.yml` now uses `cypress-io/github-action@v7`, `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`. Project Node stays `22`, which is within `engines`.
- **Verified:** workflow YAML only; **not run on GitHub yet**. Confirm the first push to `main` (or a manual **Run workflow**) is green and update this entry if anything needs adjusting.

---

## 2026-11-26 — Adopt Cypress 16.2–16.4 features, fix Node support

**Cypress:** `16.4.0` (already installed; no version bump in this change).

### 1. Node.js support range corrected
- **Why:** Cypress 16.0.0 removed Node 20 and 25. The repo still said `>=20`, so setup could pass on an unsupported Node.
- **Change:** `engines.node` is now `^22.0.0 || ^24.0.0 || >=26.0.0` in `package.json` and `tools/cypress-mcp/package.json`. `scripts/setup.mjs` enforces the same range (`requireSupportedNode`). README files updated.
- **Verified:** `npx tsc --noEmit`; local Node v26.13.1.

### 2. Agent-driven runs with `cypress open --headless` + `cypress tap` (16.3 / 16.4)
- **Why:** 16.4.0 added `cypress open --headless`: a hidden-window session that `cypress tap` can drive, without stealing focus from the editor. `cypress tap` can run a spec, report status, and read the reporter, DOM, ARIA tree, and element styles of the live app.
- **Change:**
  - `npm run cy:agent` → `cypress open --e2e --browser chrome --headless` (keeps running; stop the process to end the session).
  - `npm run cy:tap -- <subcommand>` → `cypress tap ...` shortcut.
  - `.cursor/commands/auto-heal.md`: `tap` is now the primary driver (session, run, poll `status` using `startedAt`, triage with `reporter`/`command`/`dom`/`aria`/`inspect`). Cypress MCP stays as the fallback and for flake diagnosis.
  - `.cursor/commands/discover-selectors.md`: mentions `tap aria` / `tap dom` / `tap inspect` as an alternative discovery path.
- **Usage:**
  ```bash
  npm run cy:agent &                                   # start session
  npx cypress tap run cypress/e2e/transfer-funds.cy.ts
  npx cypress tap status --json                        # poll until passed/failed and startedAt changed
  npx cypress tap reporter                             # results
  npx cypress tap aria                                 # ARIA tree of the live app
  ```
- **Notes:** `cypress tap status` reports an `error` stage if the config fails to load. `CYPRESS_AGENT_MODE=1` forces agent behaviour for agents Cypress does not detect.
- **Verified:** started `cy:agent`, ran `transfer-funds.cy.ts` via `tap run`, polled `tap status` to `passed`, read `tap reporter` and `tap aria`.

### 3. Role-based locators with `cy.getByRole()` (16.2.0)
- **Why:** role + accessible name is more resilient than CSS/ID selectors for buttons and links, and checks what a user sees.
- **Change:**
  - New `libs/ui-map/src/lib/parabank.roles.ts` (`ParaBankRoles`): `{ role, name }` targets for login/register/transfer/apply buttons and the Accounts Overview / Transfer Funds / Request Loan links.
  - New `libs/actions/src/lib/support/by-role.ts` (`byRole(target)`) wraps `cy.getByRole`.
  - App Actions (`auth`, `accounts`, `transfer-funds`, `request-loan`) now use `byRole` for those elements. New `accounts.openOverview()` replaces the raw `cy.contains('#leftPanel a', ...)` in the specs.
  - `parabank.selectors.ts` is unchanged and still holds CSS selectors for inputs and containers (ParaBank inputs have no labels). The replaced button/link selectors remain there for reference.
  - Convention: prefer role + name for native buttons, links, headings; fall back to CSS selectors. Recorded in `.cursor/rules/spec-driven.mdc` and `/discover-selectors`.
- **Verified:** `request-loan.cy.ts` and `transfer-funds.cy.ts` pass, plus a temporary spec covering register → logout → login (deleted afterwards).

---

## 2026-11-26 — Baseline: Cypress 16.4.0

Reference point for future entries. Highlights of what this version line gives us (full notes: https://docs.cypress.io/app/references/changelog):

| Version | Notable |
|---|---|
| 16.4.0 | `cypress open --headless`; `tap status` error stage; faster startup; many `cy.intercept` regression fixes; dependency security updates |
| 16.3.0 | Security fixes for `cypress open` and Chrome WebSocket endpoints; multiple handlers per `setupNodeEvents` event; agent-friendly `cypress open`; Chromium 150 |
| 16.2.0 | `cy.getByRole()` |
| 16.1.0 | `trustedCertificates` option |
| 16.0.0 | HTTP/2 in Chrome/Chromium/Edge, `keystrokeDelay` default 0, modern visibility strategy, retryable cookie/storage queries, `manageBrowserMemory` on, Node 22/24/26+ only; removed `Cypress.env()`, `cy.exec()`, `cy.end()`; Electron deprecated |

Repo impact review: no use of removed APIs (`Cypress.env`, `cy.exec`, `.end()`, `experimental*` options) in `cypress/`, `libs/`, or `cypress.config.ts`.
