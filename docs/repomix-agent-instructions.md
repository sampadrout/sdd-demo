# How to use this packed context

You are working in **sdd-demo** (Cypress + OpenSpec against ParaBank).

1. **Read this packed file first** for layout, App Actions, ui-map selectors, OpenSpec specs, and Cursor commands/skills.
2. **Do not** glob/search the whole repo for orientation unless something here is missing or stale.
3. When you need the latest single file, open that path directly (or ask to regenerate with `npm run context`).
4. After material edits, remind the human to run `npm run context` (or `/repo-context`) so the pack stays current.
5. Workflow shortcuts live under `.cursor/commands/` (`/from-jira`, `/discover-selectors`, `/openspec-apply-change`, `/auto-heal`, `/openspec-archive-change`).
6. Selectors belong in `libs/parabank-ui-map`; journeys in `apps/parabank/cypress/e2e`; behavior in `libs/parabank-actions` (ParaBank app; other apps use `libs/<app>-*`). Never invent selectors.
