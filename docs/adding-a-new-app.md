# Adding a new app to automate

How to add another application under test (for example `acme`) next to ParaBank, and build its Cypress suite the same spec-driven way. ParaBank uses the same layout, so the steps are identical for both. Background on the workspace layout is in [framework overview → Monorepo layout](framework-overview.md#monorepo-layout-npm-workspaces).

**Contents**
1. [Target layout](#1-target-layout)
2. [Create the project](#2-create-the-project)
3. [Build the suite](#3-build-the-suite)
4. [What is still per-app or manual](#4-what-is-still-per-app-or-manual)
5. [Checklist](#5-checklist)

Replace `acme` below with your app's short, lowercase name.

---

## 1. Target layout

Every app gets the same three folders. Apps never share selectors or App Actions, so one app's UI change cannot break another app's tests.

```
apps/parabank/             @sdd/parabank-e2e      ParaBank Cypress project (config, specs, support)
libs/parabank-ui-map/      @sdd/parabank-ui-map   ParaBank selectors and role targets
libs/parabank-actions/     @sdd/parabank-actions  ParaBank App Actions

apps/acme/                 @sdd/acme-e2e          acme Cypress project (same shape)
libs/acme-ui-map/          @sdd/acme-ui-map
libs/acme-actions/         @sdd/acme-actions
```

The layering rule is the same for every app: `Test → App Action → ui-map`.

## 2. Create the project

### Step 1: check the workspaces

The root `package.json` already has `"workspaces": ["apps/*", "libs/*", "tools/cypress-mcp"]`. New apps and libs are picked up by the globs, so there is nothing to add here.

### Step 2: create the two libs

`libs/acme-ui-map/package.json`

```json
{
  "name": "@sdd/acme-ui-map",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

`libs/acme-ui-map/src/index.ts`: selectors only, no `cy.*`:

```ts
export const AcmeSelectors = { /* discovered selectors go here */ } as const;
```

`libs/acme-actions/package.json`

```json
{
  "name": "@sdd/acme-actions",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "@sdd/acme-ui-map": "*" }
}
```

`libs/acme-actions/src/index.ts`: export every App Action here. Follow the ParaBank convention of one folder per feature (`src/lib/features/<feature>/main.ts`) and re-export each from this file, as `libs/parabank-actions/src/index.ts` does.

### Step 3: create the Cypress project

`apps/acme/package.json`. The scripts mirror `apps/parabank/package.json`:

```json
{
  "name": "@sdd/acme-e2e",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "cy:open": "cypress open --e2e --browser chrome",
    "cy:run": "cypress run --e2e --browser chrome",
    "cy:agent": "cypress open --e2e --browser chrome --headless",
    "cy:tap": "cypress tap",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@sdd/acme-actions": "*" }
}
```

`apps/acme/tsconfig.json` (inherits the root compiler options):

```json
{
  "extends": "../../tsconfig.json",
  "include": ["cypress/**/*.ts", "cypress.config.ts"]
}
```

`apps/acme/cypress.config.ts`. Use an **app-specific** base URL variable, not `CYPRESS_BASE_URL`: Cypress treats `CYPRESS_BASE_URL` as an override of `baseUrl` for whichever project runs, so one shell value would repoint every app.

```ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.ACME_BASE_URL || 'https://acme.example.com',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    retries: { runMode: 1, openMode: 0 },
  },
});
```

`apps/acme/cypress/support/e2e.ts`: keep thin, no business logic:

```ts
// Cypress E2E support for acme.
```

Add your base URL variable to `.env.example` too (commented, with the default).

### Step 4: install and link

From the repo root:

```bash
npm install     # links @sdd/acme-* into node_modules and updates the root package-lock.json
```

Commit the updated `package-lock.json`. After that, `npm ci` on a fresh clone installs every app.

### Step 5: run it

From the repo root (no `cd` needed):

```bash
npm run cy:open -w @sdd/acme-e2e                   # interactive runner
npm run cy:run  -w @sdd/acme-e2e                   # headless run, all acme specs
npx cypress run --e2e --project apps/acme          # same thing without the npm script
npm run typecheck                                  # every workspace, including acme
```

The root `npm run cy:run` still runs only ParaBank. `npm run cy:run:parallel -- --project=apps/acme` runs acme's specs in parallel.

## 3. Build the suite

Same flow as ParaBank, with app-specific paths:

1. **Requirement.** Write or fetch the ticket, and create the OpenSpec change with an `S-<n>` per automatable behaviour (`/from-jira <KEY>`).
2. **Discover selectors** against the live app (`/discover-selectors <url> "<thing>"`). Store them in `libs/acme-ui-map/src/index.ts` only. Prefer role + name for buttons and links, CSS selectors otherwise.
3. **App Actions.** Add `libs/acme-actions/src/lib/features/<feature>/main.ts` and export it from `libs/acme-actions/src/index.ts`.
4. **Journey spec.** Add `apps/acme/cypress/e2e/<journey>.cy.ts`. Import by package name, tag with `@jira` / `@spec`, start each `it(...)` title with `S-<n>`:

   ```ts
   import { home } from '@sdd/acme-actions';
   ```

5. **Run and heal** with `npm run cy:run -w @sdd/acme-e2e`, then `/auto-heal apps/acme/cypress/e2e/<journey>.cy.ts` if it fails.
6. **Archive** the change (`/openspec-archive-change`).

The agent commands and rules describe ParaBank paths as examples. For another app, say which app you mean in the request (for example "for the acme app, use `apps/acme` and `libs/acme-*`"), and pass `projectRoot: apps/acme` to Cypress MCP tools.

## 4. What is still per-app or manual

Verified: the ParaBank layout, workspace linking, typecheck, Cypress runs from the root, and the parallel runner. The items below are not automated for a second app yet.

| Item | Today | What to do |
|---|---|---|
| CI (`.github/workflows/cypress.yml`) | Discovers `apps/*/cypress/e2e` automatically. Each spec runs with `project` set to its app. | Nothing for a new app, but the first run after adding one has not been checked on GitHub yet. Watch that first run. |
| Cypress MCP | Default project is `apps/parabank` (`MCP_CYPRESS_PROJECT_ROOT`) | Pass `projectRoot: apps/acme` on each MCP call for acme. Changing the default per app would need a second MCP server entry. |
| OpenSpec config (`openspec/config.yaml`) | "WHERE THINGS LIVE" lists ParaBank paths only | Add the acme paths. Prefix capability names with the app (`openspec/specs/acme-<feature>/`) so they do not clash with ParaBank. |
| Rules and commands (`.cursor/rules/spec-driven.mdc`, `.cursor/commands/*.md`) | Use `<app>` placeholders, with ParaBank as the example | Name the app in each request, as in section 3. |
| Repo pack (`repomix.config.json`) | Includes `apps/*/cypress/**/*.ts` and `libs/**/*.ts` | Nothing for a new app. |
| `byRole()` helper | Lives in `@sdd/parabank-actions` | Copy the 3-line helper into `@sdd/acme-actions`, or extract a shared lib (for example `@sdd/cypress-support`) used by both apps. |
| Base URL in CI | No global `CYPRESS_BASE_URL` in CI (removed on purpose) | Keep each app's default in its `cypress.config.ts`. |

## 5. Checklist

- [ ] `libs/acme-ui-map` and `libs/acme-actions` have `package.json` and `src/index.ts`
- [ ] `apps/acme` has `package.json`, `tsconfig.json`, `cypress.config.ts`, `cypress/support/e2e.ts`
- [ ] Base URL uses `ACME_BASE_URL`, documented in `.env.example`
- [ ] `npm install` run, `package-lock.json` committed
- [ ] `npm run typecheck` is clean
- [ ] `npm run cy:run -w @sdd/acme-e2e` passes
- [ ] `openspec/config.yaml` lists the acme paths (section 4)
