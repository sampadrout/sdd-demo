# Future plan: API testing, performance testing, and multi-type testing

**Status:** Proposed. Not started. No code written.
**Date:** 2026-11-26
**Scope:** `sdd-demo` (ParaBank as the application under test)
**Related:** [framework overview](framework-overview.md), [adding a new app](adding-a-new-app.md), `.cursor/rules/spec-driven.mdc`, `openspec/specs/framework-architecture/spec.md`

**Contents**
1. [Goals and non-goals](#1-goals-and-non-goals)
2. [Current baseline](#2-current-baseline)
3. [Target architecture](#3-target-architecture)
4. [ParaBank API facts](#4-parabank-api-facts)
5. [Work plan](#5-work-plan)
6. [OpenSpec changes](#6-openspec-changes)
7. [Conventions](#7-conventions)
8. [Risks and mitigations](#8-risks-and-mitigations)
9. [Open questions](#9-open-questions)

---

## 1. Goals and non-goals

### Goals

- **G1.** Add API tests for ParaBank's REST API (`/parabank/services/bank`) alongside the existing UI journeys.
- **G2.** Use SDD traceability (`@jira`, `@spec`, `@type`) so one requirement can be verified by UI, API, and performance tests.
- **G3.** Add performance testing that reuses the API layer and states its thresholds as requirements.
- **G4.** Keep the framework open to further test types (accessibility, security, and others) without a rewrite.

### Non-goals (for this plan)

- No generic plugin engine. Shared interfaces are extracted only after a third test type exists (rule of three).
- No load testing against the public ParaBank host (`https://parabank.parasoft.com`). It is a shared third-party demo.
- No accessibility or security tooling yet.
- No change to the behaviour of existing UI journeys (`transfer-funds`, `request-loan`).

---

## 2. Current baseline

- **UI journeys:** `apps/parabank/cypress/e2e/transfer-funds.cy.ts` (SDD-1) and `request-loan.cy.ts` (SDD-2). Both register a unique user through the UI.
- **Layers:** Test → App Action (`libs/parabank-actions`) → ui-map (`libs/parabank-ui-map`) → ParaBank UI.
- **Architecture spec:** `framework-architecture` already lists `UI/API` as the layer below Command, so an API layer fits the existing design.
- **API today:** `auth.session()` uses `cy.request` only to validate the session. No API tests exist.
- **CI:** one job per spec, discovered from `apps/*/cypress/e2e/**/*.cy.ts`. Failure screenshots are uploaded.
- **Specs:** `openspec/specs/` has no performance requirements and no `@type` convention.

---

## 3. Target architecture

### 3.1 Layers

```
Test (UI or API or perf)
 ├─ UI App Action    libs/parabank-actions        (exists)
 │    └─ ui-map      libs/parabank-ui-map         (exists)
 ├─ API Action       libs/parabank-api-actions    (new: business intent + assertions)
 │    └─ API Client  libs/parabank-api-client     (new: typed endpoints, no assertions)
 │         └─ ParaBank REST  /parabank/services/bank
 └─ Perf scenario    apps/parabank/perf           (new: k6, built from API Actions)
```

- The **client** knows endpoints and types. The **actions** express intent (`api.transfer(...)`) and own assertions. This mirrors the ui-map / actions split.
- The **client** is generated types plus thin wrappers. No `cy.*` and no `expect` in the client.

### 3.2 Test types

| Type | Tag | Tool | Location | Verifies | When it runs |
|---|---|---|---|---|---|
| UI | `@type ui` | Cypress | `apps/parabank/cypress/e2e/` | Business journeys | Every push (exists) |
| API | `@type api` | Cypress `cy.request` at first | `apps/parabank/cypress/api/` | Contracts and business rules | Every push |
| Performance | `@type perf` | k6 | `apps/parabank/perf/` | Latency, throughput, error rate under load | Smoke on PR; full load nightly or pre-release |
| Later | e.g. `a11y`, `security` | TBD | TBD | TBD | As needed |

### 3.3 Why Cypress for API tests at first

- Reuses the existing project, CI matrix, and reporting, so the first step is small.
- It is heavier than a pure API runner (a browser is launched per spec). If the API suite grows, move it to Playwright's API client or Vitest. The `libs/*` layers do not change.

### 3.4 Why k6 for performance

| Tool | Fit |
|---|---|
| **k6** (proposed) | JavaScript, thresholds as code, CI-friendly. TypeScript needs a bundling step (for example esbuild). |
| Artillery | Simpler YAML/JS option. Fallback if k6 is rejected. |
| JMeter, Gatling | Heavier. Only if the team already uses them. |

Cypress is not used for load: it runs one browser test at a time, has no virtual-user or ramp-up model, and does not report latency percentiles.

---

## 4. ParaBank API facts

Source: `https://parabank.parasoft.com/parabank/services/bank/openapi.yaml`, read on 2026-11-26. The Swagger UI at `/parabank/api-docs/index.html` loads this file. The spec is live and may change, so a dated copy should be pinned in the repo (see Phase 1).

- **Base path:** `/parabank/services/bank`
- **Spec:** OpenAPI 3.0.1, API version 3.0.0, 27 operations across 8 tags.
- **Live check (read-only):** `GET /login/john/demo` returns HTTP 200 with a customer object (`id`, `firstName`, `lastName`, `address`, `phoneNumber`, `ssn`). A wrong password returns HTTP 400 with plain text `Invalid username and/or password`. The schema matches the live response.

### 4.1 Operations that map to current specs

| Capability | Operations | Used for |
|---|---|---|
| Login | `GET /login/{username}/{password}` | Get `customerId` after UI registration |
| Accounts | `GET /customers/{customerId}/accounts`, `GET /accounts/{accountId}`, `POST /createAccount` | Account IDs, balance checks |
| Money movement | `POST /transfer`, `POST /deposit`, `POST /withdraw`, `POST /billpay` | SDD-1 S-3 |
| Loans | `POST /requestLoan` (returns `LoanResponse`: `approved`, `message`, `accountId`, `loanProviderName`, `responseDate`) | SDD-2 S-3 and S-4 |
| Transactions | `GET /accounts/{accountId}/transactions` and filters (date, month, type, amount) | Post-transfer assertions |
| Customers | `GET /customers/{customerId}`, `POST /customers/update/{customerId}` | Profile checks |
| Positions | Buy, sell, history, and list operations | Not in scope now |
| Admin | `cleanDB`, `initializeDB`, `setParameter`, `startupJmsListener`, `shutdownJmsListener` | **Excluded.** See 4.3 |

### 4.2 Gaps in the spec

1. **No registration endpoint.** Customers are created through the UI. This is why the setup flow is a hybrid (see Hybrid setup in Phase 1).
2. **No documented error responses.** Every operation uses `default`. Contract tests must record observed behaviour (for example the HTTP 400 on bad login) and document it in the test, not in the spec.
3. **No authentication.** No security schemes are defined. The API is stateless from the test's point of view.
4. **Password in the URL.** `GET /login/{username}/{password}` puts the password in the path. `cy.request` logs the URL in the Cypress command log, so `{ log: false }` does not help. Use demo-only credentials and never copy this pattern for a real application.
5. **PII in responses.** The login response includes `ssn`. Assertions should check specific fields. Do not log response bodies.
6. **Mixed conventions.** State changes are `POST` with query parameters. `createAccount.newAccountType` is an integer, but `Account.type` is a string enum (`CHECKING`, `SAVINGS`, `LOAN`). Confirm mappings by discovery before writing actions.

### 4.3 Excluded operations

`cleanDB`, `initializeDB`, `setParameter`, and the JMS start and stop operations are not added to the API client. `cleanDB` and `initializeDB` would wipe the shared public demo database. If an admin client is needed later, it goes in a separate module that never runs against the public host.

---

## 5. Work plan

Each phase has deliverables and an exit criterion. Phases are sequential unless noted.

### Phase 0: Decisions and housekeeping

**Deliverables**
- Answers to the open questions in section 9 (at least Q1, Q2, Q3).
- Confirm k6 as the performance tool, or choose the alternative.
- Confirm where the local ParaBank instance runs for performance and CI.

**Exit:** decisions recorded in this document (update the Status line and a decision log).

### Phase 1: API layer and first contract tests

**Deliverables**
- Pinned copy of the spec at `libs/parabank-api-client/openapi/parabank-openapi-2026-11-26.yaml` (name uses the capture date).
- `libs/parabank-api-client`: types generated from the spec with a tool such as `openapi-typescript`, plus thin typed wrappers. No assertions.
- `libs/parabank-api-actions`: business actions, for example `api.getAccountBalance(accountId)`, `api.transfer(...)`, `api.requestLoan(...)`, `api.loginAsCustomer(username, password)`.
- Discovery for the API, following the `/discover-selectors` pattern: record real request and response shapes and observed error responses in the change `design.md`. Command name to be decided (proposal: `/discover-api`).
- Contract tests in `apps/parabank/cypress/api/`:
  - **Transfer (SDD-1 S-3):** `POST /transfer` returns a string, so the outcome is checked by reading `GET /accounts/{id}` before and after and asserting the balance change equals the amount.
  - **Loan (SDD-2 S-3 and S-4):** `POST /requestLoan` returns `approved`, `message`, `accountId`. Compare with the UI decision for the same inputs (`loanStatus`, `newAccountId`) in a hybrid test.
- Hybrid setup for `request-loan` (see Hybrid setup below), with registration kept in the UI.
- Tags on every new file: `@jira`, `@spec`, `@type api`.

**Exit criteria**
- New API tests pass on the public host and locally, and are independent (each passes when run alone).
- No selector literals in the API layer.
- No admin endpoints in the client.
- The spec copy is pinned and dated.
- `npm run typecheck` is clean for all workspaces.

### Hybrid setup (applies from Phase 1)

Registration stays in the UI, because the spec has no registration endpoint. After registration:

1. Call `api.loginAsCustomer(username, password)` (the `GET /login/...` endpoint) to get `customerId`.
2. Call `api.getAccounts(customerId)` to get account IDs.
3. Run API-based assertions and actions from there.

This keeps UI registration as the only UI setup step, and removes UI navigation for account selection. The shared `john/demo` account is not used, because the existing journeys avoid it (flakiness on the shared demo).

### Phase 2: Traceability tooling

**Deliverables**
- A checker script (for example `scripts/check-traceability.mjs`) that fails when:
  - a `.cy.ts` or perf file has no `@jira`, `@spec`, or `@type` tag,
  - a `@spec` ID does not exist in `openspec/specs/**`,
  - an `it(...)` title does not start with `S-<n>` (for UI and API specs).
- A coverage matrix output: requirement × test type, written as a markdown table in CI artifacts.
- An npm script (for example `npm run coverage:specs`) and a CI step.

**Exit criteria:** checker runs in CI and fails on a deliberately broken test (verified once, then reverted).

### Phase 3: Performance testing

**Deliverables**
- Performance requirements added to OpenSpec (see section 6): `S-P1` and onward.
- Baseline measurement on the local ParaBank instance, before any threshold is set. Thresholds come from the baseline and the requirement, not from guesses.
- `apps/parabank/perf/` with k6 scenarios built from the API actions (bundled with esbuild):
  - **Smoke:** a few virtual users, about one minute. Runs on PRs.
  - **Load:** ramp profile, run nightly or before a release.
- k6 `thresholds` that reference the requirement ID in a comment (`// S-P1`).
- A CI job for smoke; a scheduled workflow for load. Load results uploaded as artifacts.

**Exit criteria**
- Smoke passes on the local instance.
- Load run produces a summary with p95 latency and error rate.
- No perf run is pointed at the public host (enforced by config: the perf base URL must not be the public host).

### Phase 4: Open framework

**Deliverables**
- Documented contract for test types (section 7): folder, tag value, npm script, CI job.
- An npm script per type, for example `test:ui`, `test:api`, `test:perf` in `@sdd/parabank-e2e`.
- Shared, type-neutral pieces stay in one place: data factories (Faker), base-URL config, traceability tooling.
- Extract a shared runner interface **only if** a third test type is added. Otherwise keep the convention documentation only.

**Exit criteria:** adding a new test type touches only its own folder, one script, and one CI job.

---

## 6. OpenSpec changes

These are proposals to be created through `/opsx:propose`. None is created yet.

1. **`api-contract-tests`** (Phase 1)
   - Delta spec for `transfer-funds` and `request-loan`: add the API verification of existing `S-<n>` requirements. Use the existing capability folders, not new ones (the archive guard prevents fragmenting capabilities).
2. **`performance-requirements`** (Phase 3)
   - Add `S-P<n>` requirements under the existing capabilities (for example `transfer-funds`). Each states a measurable threshold (for example p95 latency and error rate at a given concurrency). Thresholds are set after the Phase 3 baseline.
3. **`test-type-conventions`** (Phase 2)
   - Update `.cursor/rules/spec-driven.mdc` with the `@type` convention and a rule that each `S-<n>` lists which test types cover it. Update `openspec/config.yaml` with the new paths.

---

## 7. Conventions

### 7.1 Tags

Every test file carries these tags in its JSDoc header:

```
@jira <KEY>
@spec S-<n>   (one per requirement covered)
@type ui | api | perf
```

- UI and API `it(...)` titles start with `S-<n>`.
- Perf scenarios reference `S-P<n>` in their thresholds.

### 7.2 Folders

```
apps/parabank/
  cypress/e2e/         UI journeys       @type ui
  cypress/api/         API contracts     @type api
  perf/                k6 scenarios      @type perf
libs/parabank-ui-map/           UI selectors (exists)
libs/parabank-actions/          UI App Actions (exists)
libs/parabank-api-client/       API client, generated types (new)
libs/parabank-api-actions/      API business actions (new)
```

### 7.3 Layering rules

- Tests call App Actions (UI or API), never raw `cy.request` or HTTP calls for business steps.
- `parabank-api-client` contains no assertions and no `cy.*` calls.
- Perf scenarios call API actions, not raw HTTP.
- Nothing in `libs/` imports from `apps/`.

### 7.4 Log hygiene

- Do not log response bodies that contain PII (`ssn`, `phoneNumber`, `address`).
- Use demo-only credentials. Credentials come from env vars for any non-public app.

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Public ParaBank is flaky (Cloudflare, shared data) | API and UI tests fail for reasons outside the repo | Run perf and CI-heavy suites on a local Docker ParaBank. Keep public-host runs small. |
| Spec drifts (live `openapi.yaml`) | Client types go stale | Pin a dated copy. Re-check on each phase. |
| No documented error codes | Negative tests rely on observed behaviour | Record observed responses in `design.md`. Mark them as observed, not specified. |
| Password in URL and PII in responses | Credentials and personal data appear in logs | Demo-only credentials; no body logging; `cy.request` URLs reviewed before CI logs are shared. |
| Admin endpoints run against shared demo | Database wiped for everyone | Excluded from the client. Enforced by code review and a lint rule (to be decided). |
| Cypress is heavy for API tests | Slower CI as the suite grows | Migration path to Playwright API client or Vitest (section 3.3). |
| k6 needs TypeScript bundling | Friction for the team | Bundle with esbuild in one npm script. Keep scenarios small. |
| Thresholds set without a baseline | Flaky or meaningless perf gates | Phase 3 requires a baseline before any threshold is written. |
| Spec copy and live app disagree | Contract tests fail for valid reasons | Contract tests report which side disagrees; spec updates go through OpenSpec. |

---

## 9. Open questions

| # | Question | Why it matters | Needed by |
|---|---|---|---|
| Q1 | Can we run ParaBank locally (Docker), and where (laptop, CI runner, shared host)? | Perf and heavy suites need it; CI config already anticipates it. | Phase 0 |
| Q2 | Who sets the perf SLO numbers (p95 latency, error rate, concurrency)? | Thresholds need an owner and a basis. | Phase 3 |
| Q3 | Is k6 acceptable, or should we use Artillery? | Affects the perf scaffolding and bundling step. | Phase 0 |
| Q4 | Start API tests in Cypress, or in Playwright or Vitest from day one? | Cypress keeps the first step small; a separate runner is cleaner long-term. | Phase 1 |
| Q5 | Should `/discover-api` be a new Cursor command, or part of `/discover-selectors`? | Keeps discovery consistent with the runtime-discovery spec. | Phase 1 |
| Q6 | Is any admin endpoint ever needed in automation? If so, on which environment? | Decides whether an admin module exists at all. | Phase 4 |
| Q7 | Should the traceability checker block PRs, or only warn at first? | Affects adoption. | Phase 2 |

---

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-26 | Plan created. No code written. | Captured from design discussion. |
