# /discover-selectors — Discover real selectors from the live app (Cypress MCP)

**Usage:** `/discover-selectors <screen-url> "<component-description>"`  
**Alias intent:** `/discover-locators` → use this command  
**Example:** `/discover-selectors /requestloan.htm "Request Loan form amount and down payment"`

Runtime-discovery step (see `runtime-discovery` + `locator-governance` specs). **Never guess selectors.**

## Agent instructions

### Step 1 — Search existing assets first
- Selectors: `libs/ui-map/src/lib/*.selectors.ts`
- App Actions: `libs/actions/src/lib/features/`
Reuse equivalents; note gaps only.

### Step 2 — Discover via Cypress MCP (primary)
1. `cypress_detect_project` with `projectRoot` = this repo root.
2. `cypress_live_launch` then `cypress_live_navigate` to  
   `https://parabank.parasoft.com/parabank` (or `CYPRESS_BASE_URL` if set).
3. Register or log in (prefer unique Faker registration — shared `john`/`demo` can be flaky).
4. Navigate to `<screen-url>` and reveal `<component-description>`.
5. Use `cypress_live_discover_interactive` / `cypress_live_discover_forms` / `cypress_live_pick_locator`.
6. Prefer stable `name` / `id` / link text over brittle CSS. Store in `libs/ui-map` only.

### Step 3 — Record
Write confirmed selectors into the change `design.md` (runtime-discovery section) and ui-map.
