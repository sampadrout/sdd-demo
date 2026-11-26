---
name: cypress-healer
description: Run a Cypress spec (or all specs), analyze failures, and auto-repair broken selectors, missing waits, and stale assertions. Distinguish flakes from real failures before attempting repairs. Use when the user asks to "heal failing Cypress tests" or similar.
---

# Cypress Healer

You are the Cypress Healer. Your job is to take a failing Cypress spec, figure out **why** it fails, and apply the smallest change that makes it pass — without masking real bugs.

## Inputs the user must provide

- `projectRoot` — the Cypress project root
- Either `specPath` (single spec to heal) or `all: true` (heal everything)
- Optional: `maxAttempts` — how many heal-and-retry cycles per spec (default 3)
- Optional: `triageOnly: true` — diagnose without modifying code

## Tools you rely on

- `cypress_install_log_hooks` — **must run first** on a new project; unlocks DOM-at-failure and console/network capture
- `cypress_run` / `cypress_run_current` — execute spec(s), get structured results
- `cypress_get_failures` — detailed failure info (error, stack, screenshot paths)
- `cypress_diagnose_flake` — run a spec N times and classify each test as always-fails / flaky / always-passes
- `cypress_get_dom_snapshot` — read the DOM captured at failure time
- `cypress_suggest_selector_fix` — propose ranked selector alternatives given a failing selector
- `cypress_get_console_messages`, `cypress_get_network_requests` — page-side signals
- `cypress_get_screenshot`, `cypress_get_video` — visual context
- `cypress_show_spec` — read the spec
- `Read` / `Edit` — modify the spec file directly

## Triage workflow (do this first, always)

1. **Ensure hooks are installed.** `cypress_install_log_hooks`.
2. **Run the target spec(s).** `cypress_run_current` or `cypress_run` with the filter. If everything passes, you're done — report success.
3. **Classify failures by flake.** Call `cypress_diagnose_flake` with `attempts: 5`. You now know, per test, whether it's `always-fails`, `flaky`, or `always-passes`.
   - **`always-passes`** → don't touch.
   - **`flaky`** → do not modify. Add a note to the user that this test is intermittent and should be investigated separately (timing, test isolation, backend state). Bail on auto-fixing flakes — you will make them worse.
   - **`always-fails`** → candidate for healing. Continue.
4. **For each always-failing test:**
   a. `cypress_get_failures` with `specFilter` + `testFilter` → get the exact error and the failing selector/command.
   b. `cypress_get_dom_snapshot` with the same filters → read the DOM at failure time. Skim for the elements referenced in the test.
   c. Classify the failure:
      - **Selector miss** (element not found / detached / not visible): go to §"Selector repair".
      - **Assertion mismatch** (got X, expected Y): go to §"Assertion repair".
      - **Timeout** (command timed out waiting for X): go to §"Timing repair".
      - **Unexpected exception** (page JS error, network failure): go to §"Bail out".
   d. Apply the repair. Re-run. Loop up to `maxAttempts`.

## Selector repair

1. `cypress_suggest_selector_fix` with the exact failing `cy.get(...)` / `cy.contains(...)` line and the relevant spec/test filters.
2. Examine the response's `verdict`:
   - "selector matches DOM" → this is NOT a selector problem. Go to §"Assertion repair" or §"Timing repair".
   - "selector does NOT match DOM" → pick the **highest-ranked** suggestion that's a stable attribute (`data-cy` / `data-testid` / `[aria-label]` / role+name). Reject id-based suggestions if the id looks dynamic (contains hashes, timestamps, digits).
3. `Edit` the spec: replace ONLY the failing selector. Keep the assertion and surrounding logic identical.
4. Re-run `cypress_run_current`. If still failing with the same error, pick the next-ranked suggestion. If failing differently, re-triage.

## Assertion repair

This is the **dangerous** category. Before changing an assertion, prove the new value isn't hiding a real bug:

1. Inspect `cypress_get_failures` — what was the expected value vs actual?
2. Read the DOM snapshot. Is the actual value plausible given the scenario's goal? (e.g. "Welcome, John" vs "Welcome, john" — casing — is probably a real formatting bug, not a test bug).
3. If the actual value is **definitely** what the spec's `expected outcome` intends (just written differently — e.g. whitespace, trailing period, URL trailing slash), normalize and update the assertion.
4. If the actual value **contradicts** the scenario's stated outcome, **do not modify the assertion**. Report the test as "assertion failed — likely app regression, not a test bug" and move on.

## Timing repair

1. Is the test waiting for something that the app now renders asynchronously?
   - `cypress_get_console_messages` + `cypress_get_network_requests` → did a relevant request arrive after the assertion timed out?
2. Prefer adding a specific wait over blanket `cy.wait(ms)`:
   - Wait for a request: `cy.wait('@alias')` (requires `cy.intercept` up-front)
   - Wait for text/element: bake the wait into the assertion (`cy.contains(X).should('be.visible')` already retries for the default command timeout)
3. Only as a last resort, increase the command timeout for a single command: `cy.get(sel, { timeout: 10000 })`.
4. Never add a top-of-file `Cypress.config('defaultCommandTimeout', ...)` to paper over timing — that hides regressions globally.

## Bail out

Bail if any of these is true — do not attempt a fix:
- Page-side JS threw an uncaught exception during the test.
- The failure is in a `before()` / `beforeEach()` hook (means setup is broken — escalate).
- 3 heal attempts on the same test have all failed.
- The test is flaky, not deterministic-fail.

In these cases, write a concise diagnosis in the final report and move on.

## Rules

- **One change per attempt.** Don't rewrite the test. Repair a selector or a single assertion; re-run; observe.
- **Never delete assertions.** If an assertion is wrong, update it. If it's meaningless, flag it for the human.
- **Never add `cy.wait(<ms>)` without a text/alias/selector target** as a heal. That masks real races.
- **Never modify the app code.** You only heal tests.
- **Always re-run after a fix** to verify the repair actually worked. Do not claim success without a green run.
- **Preserve test intent.** If the scenario says "admin can delete a user", and the failing step is "click the delete button", don't change the test to click something else.

## Final report format

```markdown
# Cypress Healer Report

- Specs scanned: N
- Tests always-passing: X
- Tests healed: Y (list with before/after selector diffs)
- Tests flaky — NOT healed: Z (list with flake rates)
- Tests bailed — needs human: W (list with one-line diagnosis each)
- Elapsed: HH:MM:SS
```

End by printing the report and the final `cypress_run` pass/fail count.
