# /auto-heal — Heal failing Cypress journey specs (optional post-apply)

**Usage:**
- `/auto-heal` — heal the active change’s journey spec (infer from context / open change)
- `/auto-heal <spec-path>` — heal a specific spec (e.g. `cypress/e2e/request-loan.cy.ts`)
- `/auto-heal --after-apply` — same as default; intended to be invoked right after `/openspec-apply-change`
- `/auto-heal --triage-only` — diagnose only; do not edit code

**When to run:** Optionally after `/openspec-apply-change`, on local Cypress failures, or to fix **pipeline** failures. Not required for archive if the journey is already green.

> **Primary driver: `cypress tap`** (Cypress 16.4+) against a headless `cypress open` session (`npm run cy:agent`). It runs specs, reads failures, and inspects the live DOM/ARIA tree without stealing focus.
> **Fallback: the in-repo Cypress MCP** (`tools/cypress-mcp/` via `.cursor/mcp.json`; build with `npm run mcp:setup`) — use for flake diagnosis (`cypress_diagnose_flake`), selector suggestions, or when `tap` is unavailable. Prefer either over raw `npx cypress run`.

## Agent instructions

### Step 0 — Refresh repo context (always)
**Every** `/auto-heal` run (including CI/pipeline triage) must regenerate the Repomix pack so heal does not re-scan the tree:

```bash
npm run context
```

Then **read** `repomix-output.md` once for ui-map, App Actions, specs, and OpenSpec `S-<n>` intent. Prefer that pack over broad Glob/Grep for orientation. Announce file/token counts from the CLI.

If `npm run context` fails, stop and report the error — do not heal against a guessed repo layout.

### Step 1 — Resolve target
1. If `<spec-path>` given → use it.
2. Else infer from the active OpenSpec change / pack / conversation: `cypress/e2e/*.cy.ts` and change `tasks.md` / design.
3. If still ambiguous, ask which spec to heal.
4. Announce: `Healing: <spec>` and `mode: triage-only | heal` (`maxAttempts` default **3**).

### Step 2 — Session (tap, preferred)
1. `npx cypress tap sessions` — reuse a running session for this project if one exists.
2. Otherwise start one **in the background** (it keeps running until you stop the process):
   ```bash
   npm run cy:agent
   ```
   Starts `cypress open --e2e --browser chrome --headless`. If `tap status` reports `error`, fix the config/project, stop the process, and start again. Stop the session when the heal is done.
3. Fallback (MCP): `cypress_detect_project` with `projectRoot` = this repo root, then `cypress_install_log_hooks` once (unlocks DOM-at-failure / console / network).

### Step 3 — Run
- **tap:** `npx cypress tap run <spec>` returns immediately. Read `npx cypress tap status --json` first and note `startedAt`; poll until `status` is `passed` or `failed` **and** `startedAt` differs from the earlier value (otherwise you are reading the previous run). Use a poll timeout — `loading` can last as long as the spec takes to build.
- **MCP fallback:** `cypress_run` (or `cypress_run_current`) for the target spec.
- Pipeline / CI: if the user pasted a failure log or CI URL summary, use that as the first triage signal, then still re-run locally (or via MCP) to confirm before editing.
- If **all green** → report success and stop. Suggest `/openspec-archive-change` when the change is complete.

### Step 4 — Triage (always before editing)
0. **tap:** `npx cypress tap reporter` (spec summary), then `tap reporter` for the failing test, `tap command` for the failing command row, and `tap dom` / `tap aria` / `tap inspect` on the failing selector against the live app.
1. MCP fallback: `cypress_get_failures` — error, stack, failing selector/command, screenshot paths.
2. Prefer `cypress_diagnose_flake` with a small attempt count when flakiness is suspected.
   - **flaky** → do **not** auto-edit; report flake and stop heal loop for that test.
   - **always-fails** → continue to repair.
3. Optionally: `cypress_get_dom_snapshot`, `cypress_get_screenshot`, console/network tools for context.
4. Use the pack to locate the failing selector’s home (`libs/ui-map` vs App Action vs spec) — do not re-walk the repo.

### Step 5 — Repair (skip if `--triage-only`)
Classify and fix **one change per attempt**, then re-run:

| Class | Action |
|---|---|
| Selector miss | Re-discover with `tap aria` / `tap dom` / `tap inspect` (or `cypress_suggest_selector_fix` + `cypress_live_*`). Prefer a role+name target in `libs/ui-map/src/lib/parabank.roles.ts` (`cy.getByRole`) for buttons/links; otherwise a CSS selector in `parabank.selectors.ts`. Update **`libs/ui-map`** first, then App Actions / spec. Never invent selectors. |
| Timing | Prefer assertion retries / `cy.wait('@alias')` / element visibility — **never** bare `cy.wait(ms)` as a heal. |
| Assertion mismatch | Only normalize when intent still matches the `S-<n>` outcome (from pack/OpenSpec). If actual contradicts the AC → **bail** (likely app/demo regression). |
| Hook / setup failure | Bail — escalate; do not paper over broken auth/setup. |

**Hard rules**
- Heal **tests / ui-map / App Actions** only — never production app code (ParaBank is third-party).
- Do not delete assertions; do not weaken `S-<n>` coverage to get green.
- Preserve journey structure (one `it` vs facets) from `spec-driven.mdc`.
- Stop after `maxAttempts` failed heal cycles on the same failure.
- After successful edits, open **real source paths** to patch; the pack is orientation only.

### Step 6 — Report
```markdown
# Auto-heal report

- Spec: <path>
- Mode: triage-only | heal
- Context pack: refreshed (npm run context) | failed
- Initial: pass | fail
- Healed: <list of edits with before→after>
- Flaky (not healed): <list>
- Bailed (needs human): <list + one-line why>
- Final run: pass | fail
- Next: `/openspec-archive-change` (if green) | re-run `/discover-selectors` | manual triage
```

## Relationship to other commands

```text
/from-jira → /discover-selectors → /openspec-apply-change → [/auto-heal] → /openspec-archive-change
# also: pipeline red → /auto-heal <spec>
```

- `/openspec-apply-change` may offer `/auto-heal` when implementation finishes or when a verification run fails.
- `/auto-heal` is **optional** — skip if Cypress is already green.
- Like `/from-jira`, heal **always** refreshes Repomix first so pipeline triage does not burn tokens re-reading the tree.
