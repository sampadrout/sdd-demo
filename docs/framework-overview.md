# Framework overview

How the **sdd-demo** automation framework is built, how it uses Cypress, and how it is kept current. The application under test is [ParaBank](https://parabank.parasoft.com/parabank); requirements are driven by OpenSpec (see [README](../README.md) and `.cursor/rules/spec-driven.mdc`).

**Contents**
1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [App Actions: how they work here](#2-app-actions-how-they-work-here)
3. [Locators: ui-map and role targets](#3-locators-ui-map-and-role-targets)
4. [Writing a journey spec](#4-writing-a-journey-spec)
5. [Cypress features and how we use them](#5-cypress-features-and-how-we-use-them)
6. [Running: local, parallel, CI, agents](#6-running-local-parallel-ci-agents)
7. [Spec-driven and agent tooling](#7-spec-driven-and-agent-tooling)
8. [Version status and how to stay current](#8-version-status-and-how-to-stay-current)
9. [Backlog](#9-backlog)
10. [Framework change log](#10-framework-change-log)

---

## 1. Architecture at a glance

The framework uses **App Actions**: business-level functions that tests call instead of raw clicks. There is **no Page Object Model**.

```
Test (cypress/e2e/*.cy.ts)
   -> App Action (libs/actions/src/lib/features/<feature>/main.ts)
        -> byRole() helper / ui-map (libs/ui-map/src/lib/*.ts)
             -> Cypress commands -> ParaBank UI
```

Dependencies only point **downward**. A test never imports `ui-map` selectors, and ui-map never calls `cy`.

| Layer | Location | Responsibility |
|---|---|---|
| Journey tests | `cypress/e2e/*.cy.ts` | Business flow, `S-<n>` traceability, test data (Faker) |
| App Actions | `libs/actions/src/lib/features/{auth,accounts,transfer-funds,request-loan}/main.ts` | One object per feature; methods express intent (`transferFunds.transfer()`) and own the waits and assertions for that step |
| Support helpers | `libs/actions/src/lib/support/by-role.ts` | `byRole(target)` wraps `cy.getByRole()` |
| Locators (CSS) | `libs/ui-map/src/lib/parabank.selectors.ts` | Selector strings for inputs and containers |
| Locators (role) | `libs/ui-map/src/lib/parabank.roles.ts` | `{ role, name }` targets for buttons and links |
| Cypress support | `cypress/support/e2e.ts`, `commands.ts` | Intentionally thin; no business logic |
| Fixtures | `cypress/fixtures/users.json` | Reference data only; journeys register unique Faker users |
| Config | `cypress.config.ts` | Base URL, timeouts, retries, spec pattern |

Source of truth for the rules: `openspec/specs/framework-architecture`, `locator-governance`, `test-design`, `test-data`, `test-healing`, `runtime-discovery`.

## 2. App Actions: how they work here

An App Action is a plain exported object whose methods run Cypress commands. Example (`libs/actions/src/lib/features/transfer-funds/main.ts`):

```ts
export const transferFunds = {
  assertFormVisible() { /* wait for #transferForm, check heading */ },
  transfer({ amount, fromIndex = 0, toIndex = 1 }: TransferRequest) { /* pick accounts, type amount, click Transfer */ },
  assertTransferComplete(amount: string) { /* assert the confirmation text */ },
};
```

| Feature | Object | Methods |
|---|---|---|
| Auth | `auth` | `visitHome`, `login`, `register`, `session`, `assertRegistered`, `assertNoRegistrationError` |
| Accounts / navigation | `accounts` | `assertOverviewVisible`, `openOverview`, `openTransferFunds`, `openRequestLoan` |
| Transfer funds | `transferFunds` | `assertFormVisible`, `transfer`, `assertTransferComplete` |
| Request loan | `requestLoan` | `assertFormVisible`, `request`, `assertDecision` |

Conventions:
- **Business intent in the name.** Methods are verbs a user would say (`transfer`, `request`, `openRequestLoan`), plus `assert*` methods for outcomes.
- **Typed inputs** (`TransferRequest`, `LoanRequest`, `CustomerRegistration`) with sensible defaults.
- **Actions own synchronization.** They rely on Cypress retry-ability (`.should('be.visible')`, `.should('have.length.at.least', 1)`) rather than fixed waits. No bare `cy.wait(ms)`.
- **Assert business outcomes**, not DOM trivia, and never remove an `S-<n>` assertion to get green.
- **One file per feature**, found by the `libs/actions/src/lib/features/<feature>/main.ts` convention.
- **Setup versus behaviour under test:** use `auth.session()` when login/registration is only setup; use `auth.register()` / `auth.login()` when it is the behaviour being verified (see [section 5](#5-cypress-features-and-how-we-use-them)).
- **No `cy.*` in ui-map.** Locator files are data only.

Adding a screen: add selectors or role targets to `libs/ui-map`, add `libs/actions/.../features/<feature>/main.ts`, then write the journey spec. Do not introduce `*.page.ts` classes.

## 3. Locators: ui-map and role targets

**Preference order for new locators**
1. **Role + accessible name** via `cy.getByRole()` for native buttons, links, and headings. Stored in `parabank.roles.ts` and used through `byRole()`.
2. **`name` / `id`** based CSS selectors for form fields and containers (ParaBank inputs have no labels). Stored in `parabank.selectors.ts`.
3. Meaningful link text. Avoid nth-child and dynamic classes.

```ts
// libs/ui-map/src/lib/parabank.roles.ts
export const ParaBankRoles = {
  transferSubmit: { role: 'button', name: 'Transfer' },
  transferFundsNav: { role: 'link', name: 'Transfer Funds' },
} as const;

// in an App Action
byRole(R.transferSubmit).click();            // role + name
cy.get(S.transferAmountInput).clear().type(amount); // CSS selector from ui-map
```

> **Known mismatch to resolve:** `openspec/specs/locator-governance/spec.md` still says selectors live only in `*.selectors.ts` and ranks `name`/`id` above `role`. The role-first convention above is documented in `.cursor/rules/spec-driven.mdc` and `/discover-selectors` but has not been merged into that OpenSpec spec. Update the spec through an OpenSpec change when convenient.

**Discovery:** selectors are never guessed. `/discover-selectors` inspects the live app (Cypress MCP, or `cypress tap aria|dom|inspect` against a headless session) and records results in ui-map and the change `design.md`.

## 4. Writing a journey spec

Rules from `.cursor/rules/spec-driven.mdc` and `openspec/specs/test-design`:
- `S-<n>` is **coverage, not one `it()` per requirement**. A sequential journey is **one `it()`** that asserts each outcome inline with `cy.log('S-<n> ...')`. Independent facets get separate `it()`s sharing a `beforeEach`.
- Every `it()` must pass when run alone (the `it.only` litmus test).
- Tag with `@jira <KEY>` and `@spec S-<n>` in the JSDoc.
- Unique Faker data per run (shared ParaBank demo DB), timestamp-based usernames, password input typed with `{ log: false }`.

Shape of `cypress/e2e/request-loan.cy.ts`:

```ts
describe('Request Loan', () => {
  const customer = { /* Faker data, built once per spec so retries reuse it */ };

  it('S-1–S-4 opens Request Loan and receives a loan decision', () => {
    auth.session(customer);              // setup (cached session)
    accounts.assertOverviewVisible();
    accounts.openRequestLoan();          // S-1
    requestLoan.assertFormVisible();
    requestLoan.request({ amount: '100', downPayment: '10' }); // S-2, S-3
    requestLoan.assertDecision();        // S-4
  });
});
```

Specs contain no selector literals for business steps. A small `cy.get('body')` check remains in `transfer-funds.cy.ts` for the post-registration landing page.

## 5. Cypress features and how we use them

Status: **Used** (in the code), **Configured** (set in config/defaults on purpose), **Default** (Cypress behaviour we rely on without code), **Not used** (available, intentionally or not yet adopted).

### Test authoring

| Feature | Status | How it is used here |
|---|---|---|
| E2E testing (`cypress open/run --e2e`) | Used | `specPattern: 'cypress/e2e/**/*.cy.ts'`; scripts `cy:open`, `cy:run` |
| TypeScript | Used | `.cy.ts` specs, `tsconfig.json` with `cypress` + `node` types; `npx tsc --noEmit -p .` checks types |
| Core commands: `visit`, `get`, `contains`, `type`, `clear`, `select`, `click`, `log`, `request` | Used | Inside App Actions; `cy.visit` uses `baseUrl`-relative paths |
| Retry-ability (queries + chained assertions) | Used | Waits are assertions (`should('be.visible')`, `have.length.at.least`). Cookie/storage getters are queries in Cypress 16 |
| `cy.getByRole()` (16.2) | Used | Role + name targets via `byRole()`; see [section 3](#3-locators-ui-map-and-role-targets) |
| `cy.session()` (`cacheAcrossSpecs`, `validate`) | Used | `auth.session(customer)` in `request-loan`; validates via `cy.request('/overview.htm')`. Cached restore took ~0.5s vs ~5.3s to register. Cache is per Cypress process, so parallel runs do not share it |
| Test isolation | Default | On by default: each test starts from a clean browser state, which is why session reuse goes through `cy.session` |
| `type(..., { log: false })` | Used | Keeps passwords out of the Command Log |
| `cy.log('S-<n> ...')` | Used | Traceability markers in the Command Log |
| `.then()` / `.invoke('text')` | Used | Reading option values and loan decision text inside actions |
| Custom commands (`Cypress.Commands.add`) | Not used | `cypress/support/commands.ts` is intentionally empty; behaviour lives in App Actions |
| `cy.intercept()` / network stubbing | Not used | Tests run against the real ParaBank. Chrome/Edge use the native network path in Cypress 16 |
| `cy.task()` / Node events | Not used | No `setupNodeEvents`. Note: multiple handlers per event are supported from 16.3 |
| `cy.fixture()` | Not used | `cypress/fixtures/users.json` exists but journeys generate unique users with Faker |
| Component testing | Not used | App under test is a third-party site |
| `cy.origin()` | Not used | Single-origin app |

### Configuration (`cypress.config.ts`)

| Option | Value | Why |
|---|---|---|
| `baseUrl` | `CYPRESS_BASE_URL` / `BASE_URL` / ParaBank public URL | Point at another deployment without code changes |
| `defaultCommandTimeout` | `15000` | Public demo can be slow |
| `pageLoadTimeout` | `60000` | Same |
| `viewportWidth` / `viewportHeight` | `1280` / `800` | Stable desktop layout |
| `retries` | `{ runMode: 1, openMode: 0 }` | Absorb demo flakiness in CI; never mask failures in `open` or `tap` |
| `video` | `false` | Faster runs, smaller artifacts |
| `screenshotOnRunFailure` | `true` | Screenshots uploaded by CI on failure |
| `supportFile` | `cypress/support/e2e.ts` | Thin; imports `commands.ts` |

Cypress 16 defaults we rely on without configuring: HTTP/2 on Chrome/Chromium/Edge, `keystrokeDelay: 0`, modern `visibilityStrategy`, `manageBrowserMemory: true`.

Secrets and env: there are no secrets today. `Cypress.env()` was removed in Cypress 16, so use `cy.env()` for sensitive values and `Cypress.expose()` for non-sensitive ones if needed. `.env` (from `.env.example`) is gitignored; `cypress.env.json` is gitignored.

### Running, scaling, debugging

| Feature | Status | How it is used here |
|---|---|---|
| `cypress run` | Used | `npm run cy:run`, `npm test` (Chrome) |
| `cypress open` | Used | `npm run cy:open` |
| `cypress open --headless` + `cypress tap` (16.4) | Used | `npm run cy:agent` and `npm run cy:tap -- <cmd>`; used by `/auto-heal` to run specs and read results, DOM, and ARIA |
| Parallelization | Used (custom) | `npm run cy:run:parallel` (one process per spec) and a GitHub Actions matrix, one job per spec. No Cypress Cloud |
| Screenshots | Used | Taken on failure, uploaded as CI artifacts, gitignored locally |
| Video | Not used | Disabled |
| Retries | Used | See configuration |
| Cypress Cloud / Test Replay / `--record` | Not used | |
| Electron browser | Not used | Deprecated in Cypress 16; we run Chrome |
| Cypress MCP server (`tools/cypress-mcp`) | Used | Live selector discovery and heal tools; separate from Cypress itself, and may overlap with `cypress tap` over time |

## 6. Running: local, parallel, CI, agents

```bash
npm run setup               # first-time: deps, Cypress binary, MCP, Playwright, OpenSpec skills, .env
npm run cy:run              # all specs headless in Chrome
npm run cy:open             # interactive runner
npm run cy:run:parallel -- --workers=4
npm run cy:agent            # headless session for agents (stop the process to end it)
npx cypress tap run cypress/e2e/transfer-funds.cy.ts
npx cypress tap status --json   # poll until passed/failed AND startedAt changed
npx cypress tap reporter
```

**CI** (`.github/workflows/cypress.yml`): on push to `main` and manual dispatch. A `discover` job lists every `cypress/e2e/**/*.cy.ts`; a matrix `e2e` job runs each spec in parallel with `cypress-io/github-action@v7` on Node 22 and Chrome, then uploads `cypress/screenshots` on failure.

**Node support:** 22.x, 24.x, and 26+. Enforced by `engines` and `scripts/setup.mjs`.

## 7. Spec-driven and agent tooling

```text
/from-jira -> /discover-selectors -> /openspec-apply-change -> [/auto-heal] -> /openspec-archive-change
```

| Piece | Location | Role |
|---|---|---|
| OpenSpec specs and changes | `openspec/specs`, `openspec/changes` | Requirements (`S-<n>`), design, tasks |
| Cursor commands | `.cursor/commands/` | `/from-jira`, `/discover-selectors`, `/auto-heal`, `/repo-context` |
| Cursor rules | `.cursor/rules/` | `spec-driven.mdc` constitution, repo-context rule |
| Repo context pack | `repomix.config.json`, `npm run context` | `repomix-output.md` for cheaper agent orientation (gitignored) |
| Cypress MCP | `tools/cypress-mcp/`, `.cursor/mcp.json` | Live discovery, run, failure triage tools |
| `cypress tap` | `npm run cy:agent` | Preferred runner for `/auto-heal` |

Heal rules: heal **tests, ui-map, and App Actions only**, diagnose before repair, never weaken `S-<n>` coverage, stop after `maxAttempts`.

## 8. Version status and how to stay current

### Current status

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

After a bump: `npm install`, `npm run cy:run`, then add a dated entry to the [change log](#10-framework-change-log) and update the table above.

**Release notes:** https://docs.cypress.io/app/references/changelog

### Baseline: what the 16.x line gives us

| Version | Notable |
|---|---|
| 16.4.0 | `cypress open --headless`; `tap status` error stage; faster startup; many `cy.intercept` regression fixes; dependency security updates |
| 16.3.0 | Security fixes for `cypress open` and Chrome WebSocket endpoints; multiple handlers per `setupNodeEvents` event; agent-friendly `cypress open`; Chromium 150 |
| 16.2.0 | `cy.getByRole()` |
| 16.1.0 | `trustedCertificates` option |
| 16.0.0 | HTTP/2 in Chrome/Chromium/Edge, `keystrokeDelay` default 0, modern visibility strategy, retryable cookie/storage queries, `manageBrowserMemory` on, Node 22/24/26+ only; removed `Cypress.env()`, `cy.exec()`, `cy.end()`; Electron deprecated |

Repo impact review: no use of removed APIs (`Cypress.env`, `cy.exec`, `.end()`, `experimental*` options) in `cypress/`, `libs/`, or `cypress.config.ts`.

## 9. Backlog

Known Cypress features not yet adopted, or deliberately limited.

| Feature | Cypress | Idea |
|---|---|---|
| `cy.session()` in `transfer-funds` | 12+ | Not used there: its S-1 requires registration, so it must register in the test. Revisit if a shared-customer spec appears |
| `cy.getByRole()` for headings and labelled fields | 16.2.0 | ParaBank inputs have no labels today; revisit if markup changes |
| Replace parts of `tools/cypress-mcp` with `cypress tap` | 16.4.0 | Evaluate overlap (run, failures, DOM/ARIA inspection) |
| `trustedCertificates` | 16.1.0 | Only if we point at a self-signed environment |

---

## 10. Framework change log

Newest first. Add an entry whenever the framework changes (Cypress/Node bump, new convention, script, CI change): **what changed, why, where, how it was verified**.

### 2026-11-26 — Session reuse, run-mode retries, CI action upgrades

**Cypress:** `16.4.0` (no version bump).

#### 4. `cy.session()` for authenticated setup
- **Why:** `request-loan` registers a customer only as setup (its `S-1`–`S-4` start at "open Request Loan"). Registration took ~5s; restoring a cached session took ~0.5s in a probe.
- **Change:**
  - `auth.session(customer)` in `libs/actions/src/lib/features/auth/main.ts` wraps `cy.session(['parabank', username], register…, { cacheAcrossSpecs: true, validate })`, then visits `/overview.htm`. `validate` calls `cy.request('/overview.htm')` and requires the "Accounts Overview" text, so a dead server session is recreated.
  - `request-loan.cy.ts` builds its customer once at `describe` level (not per attempt) and calls `auth.session(customer)`, so a retry restores the session instead of registering again.
  - `transfer-funds.cy.ts` is unchanged: its `S-1` is registration, so it keeps calling `auth.register()` directly.
- **Convention:** use `auth.session()` when registration/login is setup; use `auth.register()` / `auth.login()` when it is the behaviour under test.
- **Limits:** the session cache lives in one Cypress process. Parallel runs (`cy:run:parallel`, one CI job per spec) do not share it.
- **Verified:** both specs pass; temporary probe confirmed a second `auth.session()` call restored the session (0.5s vs 5.3s) and that an unauthenticated `/overview.htm` lacks the validate marker (probe deleted).

#### 5. Run-mode retries
- **Why:** ParaBank is a shared public demo and occasionally flaky.
- **Change:** `retries: { runMode: 1, openMode: 0 }` in `cypress.config.ts`. `cypress open` and `tap` sessions never retry, so local/agent failures stay visible and `/auto-heal` triage is not masked.
- **Left unchanged:** `defaultCommandTimeout: 15000` and the other timeouts. `keystrokeDelay` stays at the Cypress 16 default of `0`; set it to `10` only if typing becomes flaky.
- **Caveat:** a test that passes on retry is still reported as passed. Watch for repeated retries in CI logs as a flake signal.

#### 6. CI: Node 24-based actions
- **Why:** `cypress-io/github-action@v6` runs on Node 20 and is deprecated as of v7.0.0 (Node 24). The other actions had v7 majors.
- **Change:** `.github/workflows/cypress.yml` now uses `cypress-io/github-action@v7`, `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`. Project Node stays `22`, which is within `engines`.
- **Verified:** workflow YAML only; **not run on GitHub yet**. Confirm the first push to `main` (or a manual **Run workflow**) is green and update this entry if anything needs adjusting.

---

### 2026-11-26 — Adopt Cypress 16.2–16.4 features, fix Node support

**Cypress:** `16.4.0` (already installed; no version bump in this change).

#### 1. Node.js support range corrected
- **Why:** Cypress 16.0.0 removed Node 20 and 25. The repo still said `>=20`, so setup could pass on an unsupported Node.
- **Change:** `engines.node` is now `^22.0.0 || ^24.0.0 || >=26.0.0` in `package.json` and `tools/cypress-mcp/package.json`. `scripts/setup.mjs` enforces the same range (`requireSupportedNode`). README files updated.
- **Verified:** `npx tsc --noEmit`; local Node v26.13.1.

#### 2. Agent-driven runs with `cypress open --headless` + `cypress tap` (16.3 / 16.4)
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

#### 3. Role-based locators with `cy.getByRole()` (16.2.0)
- **Why:** role + accessible name is more resilient than CSS/ID selectors for buttons and links, and checks what a user sees.
- **Change:**
  - New `libs/ui-map/src/lib/parabank.roles.ts` (`ParaBankRoles`): `{ role, name }` targets for login/register/transfer/apply buttons and the Accounts Overview / Transfer Funds / Request Loan links.
  - New `libs/actions/src/lib/support/by-role.ts` (`byRole(target)`) wraps `cy.getByRole`.
  - App Actions (`auth`, `accounts`, `transfer-funds`, `request-loan`) now use `byRole` for those elements. New `accounts.openOverview()` replaces the raw `cy.contains('#leftPanel a', ...)` in the specs.
  - `parabank.selectors.ts` is unchanged and still holds CSS selectors for inputs and containers (ParaBank inputs have no labels). The replaced button/link selectors remain there for reference.
  - Convention: prefer role + name for native buttons, links, headings; fall back to CSS selectors. Recorded in `.cursor/rules/spec-driven.mdc` and `/discover-selectors`.
- **Verified:** `request-loan.cy.ts` and `transfer-funds.cy.ts` pass, plus a temporary spec covering register → logout → login (deleted afterwards).
