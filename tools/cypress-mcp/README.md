# Cypress MCP

**A Model Context Protocol (MCP) server that lets AI agents explore a live app, and author, run, debug, and self-heal Cypress tests.**

This copy lives inside the `sdd-demo` repo at `tools/cypress-mcp/` and is wired into Cursor through `.cursor/mcp.json`. It exposes **53 tools** (26 of them Playwright-driven live-browser tools) and ships **3 optional agent skills** (`cypress-planner`, `cypress-generator`, `cypress-healer`).

| Component | Version |
|---|---|
| Node.js | 20+ |
| Playwright (live browser, bundled in the server only) | 1.65.1 (pinned) |
| Cypress (dev dependency for types; the server runs the **target project's** Cypress) | ^16.4.0 |
| `@modelcontextprotocol/sdk` | ^1.0.4 |

> **In this repo it is mostly used for two things:** runtime selector discovery (`/discover-selectors`) and failure triage/healing (`/auto-heal`). See [How it works with SDD](#how-it-works-with-sdd) and [What the SDD flow uses (and doesn't)](#what-the-sdd-flow-uses-and-doesnt).

---

## Contents

- [How it compares](#how-it-compares)
- [Installation](#installation)
- [Wiring it into an MCP client](#wiring-it-into-an-mcp-client)
- [First-run setup](#first-run-setup)
- [How it works](#how-it-works)
- [How it works with SDD](#how-it-works-with-sdd)
- [What the SDD flow uses (and doesn't)](#what-the-sdd-flow-uses-and-doesnt)
- [User manual](#user-manual)
  - [The three agents](#the-three-agents)
  - [End-to-end workflow example](#end-to-end-workflow-example)
  - [Tool reference](#tool-reference)
- [Architecture notes](#architecture-notes)
- [FAQs](#faqs)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## How it compares

| | Cypress MCP | Playwright MCP | Chrome DevTools MCP |
|---|---|---|---|
| Primary job | Author & heal **Cypress tests** | Drive a live browser (generic automation) | Inspect a live browser (perf, network, DOM) |
| Runs tests | ✅ Cypress | ❌ (not a test runner) | ❌ |
| Live browser control | ✅ Playwright-driven | ✅ Playwright-driven | ✅ CDP |
| Records live actions as specs | ✅ `appendToSpec: true` on live tools | ❌ | ❌ |
| Auto-heals failing tests | ✅ `cypress-healer` agent | ❌ | ❌ |
| Three pre-built agent skills | ✅ planner / generator / healer | ✅ (similar pattern) | ❌ |

---

## Installation

### Prerequisites

- **Node.js 20+** and npm 10+
- A Cypress project with Cypress >= 12 installed (the SDD repo root has Cypress 16.4)
- macOS, Linux, or Windows (WSL OK)

Downloads outside `npm install`: Chromium (~100 MB, Playwright) and the Cypress binary (~150 MB).

### Install and build (from the `sdd-demo` repo root)

A fresh clone should run `npm run setup` once. That installs repo dependencies, the Cypress binary, this MCP server, Playwright Chromium, and refreshes the OpenSpec skills. It is the same command on macOS and Windows (Node.js 20+ required).

To rebuild only this server:

```bash
npm run mcp:setup   # npm ci + tsc build in tools/cypress-mcp, then `playwright install chromium`
npm run mcp:build   # rebuild only, after editing tools/cypress-mcp/src
```

`mcp:setup` produces `tools/cypress-mcp/dist/server.js` (the MCP entry point) and downloads Chromium (~100 MB, once) for the `cypress_live_*` tools. `dist/` and `node_modules/` are gitignored, so every fresh clone must run `npm run mcp:setup`.

Standalone (outside the SDD repo), from this folder:

```bash
npm install && npm run build && npx playwright install chromium
```

### Cypress in the target project

The server does **not** use its own Cypress to run tests. It resolves `cypress` from the **project it is pointed at** (`loadCypress()` in `src/util/project.ts`), so tests always run on the project's version. In `sdd-demo` that is the root `package.json` (`cypress ^16.4.0`). The copy in this folder's `devDependencies` is only for TypeScript types.

```bash
npx cypress install   # one time; downloads the Cypress binary
```

---

## Wiring it into an MCP client

### Cursor (this repo)

Already configured in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cypress": {
      "command": "node",
      "args": ["${workspaceFolder}/tools/cypress-mcp/dist/server.js"]
    }
  }
}
```

After `npm run mcp:setup` or `npm run mcp:build`, reload the MCP server (or the window) so Cursor picks up the new `dist/`. Tools appear under the `project-0-sdd-demo-cypress` namespace.

### Claude Code / Claude Desktop / others

Any stdio MCP client works with the same `command` + `args` pair, using an absolute path to `dist/server.js`:

```bash
claude mcp add cypress node /absolute/path/to/sdd-demo/tools/cypress-mcp/dist/server.js
```

### Verify

Ask the agent to list the `cypress_*` tools, or smoke-test the server directly:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}\n' \
  | node tools/cypress-mcp/dist/server.js
```

You should see `cypress-mcp server ready on stdio` on stderr and a JSON `initialize` result on stdout.

---

## First-run setup

Run once per Cypress project, from a session where the MCP server is connected:

```
1. cypress_detect_project        # confirms Cypress is installed, finds config/specs
2. cypress_install_log_hooks     # captures console + network + DOM-at-failure
```

`cypress_install_log_hooks` **edits the target project**: it inserts blocks marked `// --- BEGIN MCP HOOKS ---` into `cypress/support/e2e.{ts,js}` and `cypress.config.{ts,js}`, and failing runs then write to `cypress/logs/`. In `sdd-demo` this has **not** been run yet; `/auto-heal` runs it on first use. Review (and consider gitignoring `cypress/logs/`) before committing.

`cypress_install_skills` is optional and **not used in the SDD flow** (see below). It only writes to `~/.claude/skills/` (or `<projectRoot>/.claude/skills/` with `scope: "project"`). It does not install into `.cursor/` or `.agents/`.

---

## How it works

The server is a local Node program Cursor starts over **stdio**. It registers 53 tools and dispatches each call by name (`src/server.ts` and `src/tools/index.ts`).

```
Cursor agent ── MCP (JSON-RPC over stdio) ──▶ src/server.ts
                                                │
                    ┌───────────────────────────┼────────────────────────────┐
                    ▼                           ▼                            ▼
        live tools (Playwright)        spec tools (codegen)         run tools (Cypress API)
        src/tools/live/*               append-steps, new-spec        run, run-current, open
        src/browser/manager.ts         src/util/spec-builder.ts      loadCypress(projectRoot)
```

**Two engines.** Cypress tests execute inside the browser and have no external control channel, so live exploration is done with Playwright (inside the server only; it is never added to your project), while test execution uses the project's own Cypress via its module API.

**The bridge: `appendToSpec`.** Live interaction tools (`click`, `type`, `fill`, `navigate`, ...) accept `appendToSpec: true`. The action runs in the live browser *and* a matching `cy.*` line is appended to the session's current spec (`cypress_append_steps` maps ~35 action types to Cypress code). Nothing is verified until `cypress_run`.

**State.**
- `src/session.ts` keeps the project root and the "current spec" so tool calls do not repeat paths.
- `src/browser/manager.ts` keeps one live browser/page plus rolling buffers (1000 entries) of console messages and network requests. A launch-in-flight promise makes concurrent calls wait for the browser.
- `src/state.ts` keeps the last `cypress_run` summary for `cypress_get_failures`.

**Failure diagnosis loop** (what the healer relies on):
1. `cypress_install_log_hooks` makes failing runs save DOM, console and network into `cypress/logs/`.
2. `cypress_diagnose_flake` re-runs a spec N times: `always-fails` / `flaky` / `always-passes`.
3. `cypress_get_failures` + `cypress_get_dom_snapshot` give the error and the DOM at failure time.
4. `cypress_suggest_selector_fix` ranks replacement selectors (`data-cy` > `data-testid` > `id` > `aria-label` > role+text).

---

## How it works with SDD

In `sdd-demo` the MCP is a **tool provider for two Cursor commands**. It does not author specs; specs are written by `/openspec-apply-change` as App Actions + ui-map selectors (`spec-driven.mdc`: tests call business intent, never raw `cy.get`).

```text
/from-jira ──▶ /discover-selectors ──▶ /openspec-apply-change ──▶ [/auto-heal] ──▶ /openspec-archive-change
 (Atlassian      (Cypress MCP:            (writes App Actions,       (Cypress MCP:     (merge specs)
  MCP, Repomix)   live discovery)          ui-map, *.cy.ts)           run + triage)
```

| SDD step | Cypress MCP tools | Output / rule |
|---|---|---|
| `/discover-selectors <url> "<thing>"` | `cypress_detect_project` → `cypress_live_launch` → `cypress_live_navigate` → (register/log in with `cypress_live_fill`/`click`) → `cypress_live_discover_interactive`, `cypress_live_discover_forms`, `cypress_live_pick_locator` | Selectors go into `libs/ui-map/src/lib/*.selectors.ts` and the change `design.md`. Never guess selectors. |
| `/auto-heal [spec]` | `cypress_detect_project`, `cypress_install_log_hooks`, `cypress_run` / `cypress_run_current`, `cypress_get_failures`, `cypress_diagnose_flake`, `cypress_get_dom_snapshot`, `cypress_get_screenshot`, `cypress_suggest_selector_fix`, console/network getters, `cypress_live_*` for re-discovery | Heals **ui-map / App Actions / spec** only, never ParaBank. Flaky = report only. Never weakens `S-<n>` assertions. Max 3 attempts. |
| `/openspec-apply-change` | none (optionally offers `/auto-heal` when a run fails) | Authors App Actions + journey test by hand. |
| `/from-jira`, `/openspec-*`, `/repo-context` | none | Uses Atlassian MCP, OpenSpec, Repomix. |

All commands pass `projectRoot` = the `sdd-demo` repo root, so the server runs the repo's Cypress 16.4 against `cypress.config.ts` and `cypress/e2e/`.

---

## What the SDD flow uses (and doesn't)

### Skills

| Skill | Used in SDD? | Why |
|---|---|---|
| `cypress-planner` (explore app, write `scenarios.md`) | **No** | Requirements come from Jira and OpenSpec (`S-<n>`), not from a crawl-generated `scenarios.md`. |
| `cypress-generator` (scenarios to `*.cy.ts`) | **No** | It emits raw `cy.get(...)` specs plus a `loginAs` command. That breaks the App Actions layering and `S-<n>` traceability. |
| `cypress-healer` | **No (replaced)** | `/auto-heal` is the SDD version of the same loop, with ui-map-first fixes and the "never weaken `S-<n>`" rule. |

None of the three is installed anywhere for this repo. If you want one, copy its `SKILL.md` into `.agents/skills/` and adapt it to the SDD rules first. `cypress_install_skills` will not put them there.

### Tools

| Group | Tools | Status in SDD |
|---|---|---|
| Live discovery | `cypress_live_launch/close/navigate`, `discover_interactive`, `discover_forms`, `pick_locator`, `snapshot`, `screenshot` | **Used** (`/discover-selectors`, `/auto-heal` re-discovery) |
| Live interaction | `cypress_live_click/type/fill/select/press_key/hover/wait_for` | **Used implicitly** to log in or reach a screen during discovery. Do not use `appendToSpec` (see below). |
| Run + inspect failures | `cypress_detect_project`, `run`, `run_current`, `get_failures`, `get_screenshot`, `get_dom_snapshot`, `diagnose_flake`, `suggest_selector_fix`, console/network getters | **Used** (`/auto-heal`) |
| Hooks | `cypress_install_log_hooks` | **Used** by `/auto-heal`; not yet run in this repo |
| Spec authoring | `cypress_new_spec`, `append_steps`, `set/get_current_spec`, `show_spec`, `appendToSpec` flag | **Not used.** Emits raw `cy.*`; the SDD rule is App Actions only. |
| Scaffolding | `cypress_add_custom_command`, `manage_fixture`, `seed_from_api`, `generate_locator`, `generate_intercept_from_har` | **Not used** |
| Misc | `cypress_open/close`, `cypress_storage`, `cypress_get_video`, `cypress_install_skills`, `cypress_live_evaluate/highlight/get_outer_html/resize/reload/go_back/enumerate_links/install_browsers` | **Available, not wired into any command** |

---

## User manual

### The three agents

#### `/cypress-planner`

**Input:** application URL + credentials.
**Output:** `scenarios.md` describing user journeys, acceptance criteria, and observed selectors.

The planner launches a real browser, logs in, crawls the app (using `cypress_live_enumerate_links`, `cypress_live_discover_forms`, `cypress_live_discover_interactive`), and writes a structured scenarios document. **Credentials are never written into the output** — only referenced by role.

#### `/cypress-generator`

**Input:** path to a `scenarios.md` + credentials.
**Output:** one `*.cy.ts` per scenario under `cypress/e2e/`, plus a shared `loginAs` custom command and a `users.json` fixture.

The generator reads the scenarios, installs a reusable `loginAs` command via `cypress_add_custom_command`, stores credentials in a fixture via `cypress_manage_fixture`, and emits Cypress code via `cypress_append_steps`. It does not try to heal failures — that's the healer's job.

#### `/cypress-healer`

**Input:** `specPath` (single spec) or `all: true`.
**Output:** repaired specs, plus a diagnosis report for tests it chose not to touch.

The healer's workflow:
1. Runs the spec(s).
2. Calls `cypress_diagnose_flake` with 5 attempts to classify each test as `always-fails` / `flaky` / `always-passes`.
3. **Never auto-heals flaky tests** — it flags them for human review.
4. For always-failing tests, reads `cypress_get_dom_snapshot`, calls `cypress_suggest_selector_fix`, applies the highest-ranked stable-attribute repair, re-runs.
5. Bails out after 3 failed attempts per test, on `beforeEach` failures, or on uncaught page exceptions.

### End-to-end workflow example

```
User: "Point at https://demo-app.example.com, log in as admin@x.com / pw,
       plan tests for the dashboard, generate them, then heal any failures."

Agent invokes:
  /cypress-planner url=https://demo-app.example.com credentials={admin: {...}}
  → writes scenarios.md

  /cypress-generator scenariosPath=scenarios.md projectRoot=./my-app
  → writes cypress/e2e/*.cy.ts, loginAs command, users.json fixture

  /cypress-healer all=true maxAttempts=3
  → runs, diagnoses, repairs, reports
```

### Tool reference

53 tools grouped by purpose:

**Project discovery + execution (6)**
`cypress_detect_project`, `cypress_list_specs`, `cypress_run`, `cypress_run_current`, `cypress_open`, `cypress_close`

**Spec authoring (5)**
`cypress_new_spec`, `cypress_set_current_spec`, `cypress_get_current_spec`, `cypress_show_spec`, `cypress_append_steps` *(workhorse with 35+ actions: visit, click, type, hover, select, press_key, upload, fill_form, drag, wait, viewport, screenshot, verify_*, intercept, set_cookie, set_localstorage, etc.)*

**Storage & network codegen (1)**
`cypress_storage` *(dispatcher covering 17 Playwright-MCP storage tools)*

**Failure & artifact inspection (6)**
`cypress_get_failures`, `cypress_get_screenshot`, `cypress_get_video`, `cypress_get_console_messages`, `cypress_get_network_requests`, `cypress_install_log_hooks`

**Healer stack (3)**
`cypress_get_dom_snapshot`, `cypress_suggest_selector_fix`, `cypress_diagnose_flake`

**Generator stack (3)**
`cypress_add_custom_command`, `cypress_manage_fixture`, `cypress_seed_from_api`

**Code generators (2)**
`cypress_generate_locator`, `cypress_generate_intercept_from_har`

**Agent skills (1)**
`cypress_install_skills`

**Persistent live browser — Playwright-powered (26)**
`cypress_live_launch`, `cypress_live_close`, `cypress_live_resize`, `cypress_live_install_browsers`,
`cypress_live_navigate`, `cypress_live_go_back`, `cypress_live_reload`,
`cypress_live_snapshot`, `cypress_live_screenshot`,
`cypress_live_click`, `cypress_live_type`, `cypress_live_hover`, `cypress_live_press_key`, `cypress_live_fill`, `cypress_live_select`,
`cypress_live_pick_locator`, `cypress_live_highlight`, `cypress_live_hide_highlight`, `cypress_live_evaluate`, `cypress_live_get_outer_html`,
`cypress_live_wait_for`, `cypress_live_console_messages`, `cypress_live_network_requests`,
`cypress_live_enumerate_links`, `cypress_live_discover_forms`, `cypress_live_discover_interactive`

All live interact tools (`click`, `type`, `navigate`, etc.) accept `appendToSpec: true` to mirror the action as a `cy.*` line in the session's current spec.

---

## Architecture notes

- **Playwright inside a Cypress MCP?** Cypress tests run *inside* the browser via its own command queue — there's no external RPC for live control. Pairing Cypress (test execution) with Playwright (live exploration) is strictly better than forcing Cypress to be something it isn't. Playwright is used only inside the MCP server; it is **not** added to your project.
- **Two state layers:** a session singleton tracks the "current spec" and the live-browser handle across MCP tool calls. This is what makes `cypress_append_steps` work without passing a spec path on every call.
- **Launch race safety:** the live-browser manager uses an in-flight promise guard so concurrent `cypress_live_*` calls during launch wait correctly instead of seeing partial state.
- **Stdout isolation:** during `cypress.run()`, the MCP server redirects Cypress's stdout banners to stderr so the JSON-RPC stream on stdout stays clean.

---

## FAQs

**Q: Does the MCP server have network access to my app? Will my code or credentials be sent anywhere?**
No. The server runs entirely locally on your machine. It drives a local Chromium via Playwright, executes Cypress locally, and reads/writes files in your project. Credentials you pass to the planner live only in memory for that session and (when explicitly chosen by the generator) in a local fixture you control.

**Q: Which Cypress versions are supported?**
Cypress 12+ (peer dependency). The SDD repo and this package's dev dependency are on 16.4.x (binary verified with `cypress verify`). Earlier 10.x may work but isn't tested.

**Q: Does it support component testing?**
Yes — `cypress_run`, `cypress_run_current`, and `cypress_list_specs` accept `testingType: "component"`. Component-specific tooling beyond that is a future enhancement.

**Q: Can the healer break my tests?**
The healer follows strict rules (see [cypress-healer skill](skills/cypress-healer/SKILL.md)): one change per attempt, never modifies the app code, never deletes assertions, never auto-fixes flakes, always re-runs to verify. If you want to review changes without applying them, run with `triageOnly: true`.

**Q: Why doesn't the healer auto-fix flaky tests?**
Flakes indicate timing bugs or test-isolation bugs, not selector bugs. Auto-"fixing" a flake usually makes it *worse* (over-broad timeouts, hidden races). The healer flags flakes for human review with timing data and moves on.

**Q: Where are DOM snapshots stored?**
`cypress/logs/dom-snapshots/` inside your project. One `.html` file + one `.json` metadata file per failing test. The index is `cypress/logs/dom-snapshots.json` (newline-delimited JSON).

**Q: Do I have to re-run `cypress_install_log_hooks` every time?**
No, it's idempotent and edits your `cypress/support/e2e.{ts,js}` + `cypress.config.{ts,js}` once. Run it again if you want to reinstall.

**Q: How do I uninstall the hooks?**
Manually remove the blocks marked `// --- BEGIN MCP HOOKS ---` ... `// --- END MCP HOOKS ---` from your support file and config file. An automated uninstall is on the roadmap.

**Q: Will this work against sites with anti-bot / Cloudflare / SSO?**
The planner drives a real Chromium (same engine as Chrome) — most sites work. Aggressive bot-detection (Cloudflare challenge pages, WebAuthn, biometric auth) will block you. Provide pre-logged-in cookies via `cypress_live_launch`'s `storageStatePath` as a workaround.

**Q: Can I use this with Cypress Cloud (the paid dashboard)?**
Not directly yet — `cypress_run` currently doesn't pass `--record --key`. A `cypress_dashboard_record` tool is on the roadmap.

**Q: Does `cypress_append_steps` support all Cypress commands?**
It supports 35+ actions covering the common e2e surface. For anything else, use the `raw` action with a literal `cy.*` line — that's the escape hatch.

**Q: Will the live browser conflict with `cypress open`?**
No, they're independent processes driving different Chromium instances. You can have `cypress_open` and `cypress_live_launch` running simultaneously.

**Q: How much context does this consume?**
Each tool schema is registered once. The 53 tools total ~15KB of tool-list JSON, well under any agent's context budget. Individual tool results are bounded (e.g. `cypress_get_dom_snapshot` truncates to 200KB, `cypress_live_snapshot` to 20KB).

**Q: Can I use this without the agent skills (just the tools)?**
Yes — the MCP server is useful on its own for any agent that can call MCP tools. The three skills are pre-built prompts that orchestrate the tools for the common workflows.

---

## Troubleshooting

**"Playwright browser binary missing"**
Run `npx playwright install chromium` (or `cypress_live_install_browsers`).

**"Cypress binary not found"**
In your target project: `npx cypress install` and then `npx cypress verify`.

**"No DOM snapshots. Call cypress_install_log_hooks first."**
DOM capture requires the hooks. Run `cypress_install_log_hooks` once per project, then run the failing spec. Hooks are idempotent.

**"JSON parse error" from the MCP client during `cypress_run`**
You're on an old build before the stdout-isolation fix. Pull latest and `npm run build` again.

**`cypress_suggest_selector_fix` returns empty candidates**
The failing selector doesn't share any tokens with elements in the snapshot. Pass a `cy.contains("…")` variant if you know the visible text, or check whether the snapshot is stale (maybe the failing run is old — re-run and try again).

**`cypress_live_launch` hangs**
On macOS, the very first launch is slow (Gatekeeper verifies the Chromium bundle). Give it ~30 seconds. If it still hangs, kill the process and re-run — subsequent launches are fast.

**Tests that pass locally fail under the healer's `diagnose_flake`**
That means they *are* flaky — the healer is surfacing a real issue. Check for shared state between tests, uncleared cookies/localStorage, or race conditions with backend seeding.

**The healer keeps picking the same wrong selector**
Selector ranking prefers `data-cy` → `data-testid` → `id` → `aria-label` → role+text. If your app lacks stable attributes, the healer will fall back to fragile ids. Adding `data-cy` to the component under test is the real fix.

---

## License

MIT.
