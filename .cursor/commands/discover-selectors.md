# /discover-selectors — Discover real selectors from the live app (Cypress MCP)

**Usage:** `/discover-selectors <screen-url> "<component-description>"`  
**Alias intent:** `/discover-locators` → use this command  
**Example:** `/discover-selectors /requestloan.htm "Request Loan form amount and down payment"`

Runtime-discovery step (see `runtime-discovery` + `locator-governance` specs). **Never guess selectors.**

> Cypress MCP is the in-repo server at `tools/cypress-mcp/` (wired in `.cursor/mcp.json`; build with `npm run mcp:setup`). There is no public `@cypress/mcp` npm package. See `tools/cypress-mcp/README.md`.


## Agent instructions

### Step 1 — Search existing assets first
- Selectors: `libs/parabank-ui-map/src/lib/*.selectors.ts` (ParaBank; for another app use its `libs/<app>-ui-map`)
- App Actions: `libs/parabank-actions/src/lib/features/` (ParaBank; for another app use its `libs/<app>-actions`)
Reuse equivalents; note gaps only.

### Step 2 — Discover via Cypress MCP (primary)
> Alternative (Cypress 16.4+): with `npm run cy:agent` running, `npx cypress tap aria` / `tap dom` / `tap inspect` read the **ARIA tree and DOM of the live AUT** after a spec has driven it to the right screen. Use it to confirm role + accessible name for `cy.getByRole`.
1. `cypress_detect_project` with `projectRoot` = this repo root.
2. `cypress_live_launch` then `cypress_live_navigate` to  
   `https://parabank.parasoft.com/parabank` (or `CYPRESS_BASE_URL` if set).
3. Register or log in (prefer unique Faker registration — shared `john`/`demo` can be flaky).
4. Navigate to `<screen-url>` and reveal `<component-description>`.
5. Use `cypress_live_discover_interactive` / `cypress_live_discover_forms` / `cypress_live_pick_locator`.
6. **Prefer role + accessible name** (`cy.getByRole`, Cypress 16.2+) for native buttons, links, and headings — record as `{ role, name }` in `libs/parabank-ui-map/src/lib/parabank.roles.ts` and call via `byRole()` (`libs/parabank-actions/src/lib/support/by-role.ts`).
7. Otherwise (inputs without labels, containers) prefer stable `name` / `id` over brittle CSS and store in `parabank.selectors.ts`. Store in the app's `ui-map` lib only.

### Step 3 — Record
Write confirmed selectors into the change `design.md` (runtime-discovery section) and ui-map.
