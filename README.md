# sdd-demo

Spec-Driven Development (SDD) demo suite: **OpenSpec + Cypress App Actions** against [ParaBank](https://parabank.parasoft.com/parabank).

This is a slim showcase derived from the PlatformTests SDD constitution — not a fork of the Extreme Reach product suite.

## What it demonstrates

| Stage | Artefact |
|---|---|
| Requirements | `openspec/specs/transfer-funds/spec.md` (`S-1`–`S-4`) |
| Change archive | `openspec/changes/archive/2026-11-23-parabank-transfer-funds/` |
| Selectors | `libs/ui-map/src/lib/parabank.selectors.ts` |
| App Actions | `libs/actions/src/lib/features/{auth,accounts,transfer-funds}/` |
| Journey test | `cypress/e2e/transfer-funds.cy.ts` |

Layering (only allowed direction):

```
Test → App Action → Selectors / UI → ParaBank
```

No Page Object Model. Tests call business intent (`transferFunds.transfer()`), not raw clicks.

## Quick start

```bash
npm ci
npx cypress install
npm run cy:run
```

Open the runner:

```bash
npm run cy:open
```

## CI

GitHub Actions runs the ParaBank journey on every push to `main` and on demand:

- Workflow: `.github/workflows/cypress.yml`
- Manual run: **Actions → Cypress → Run workflow**
- CI starts `parasoft/parabank` in Docker and sets `CYPRESS_BASE_URL=http://localhost:8080/parabank`
  (the public host is Cloudflare-protected and blocks GitHub Actions IPs)

Local runs still default to https://parabank.parasoft.com/parabank. To hit a local container:

```bash
docker run -d --name parabank -p 8080:8080 parasoft/parabank:latest
CYPRESS_BASE_URL=http://localhost:8080/parabank npm run cy:run
```

## Sample journey (DEMO-1)

`S-1–S-4` registers a unique customer (Faker), opens **Transfer Funds**, submits a transfer, and asserts **Transfer Complete!**.

## OpenSpec workflow

```bash
npx openspec new change "my-change"
# then /opsx:propose → /opsx:apply → /opsx:archive in Cursor
```

Cursor rules live in `.cursor/rules/spec-driven.mdc`. Skills under `.cursor/skills/openspec-*`.

## Why ParaBank?

Public, always-on bank demo with real multi-step journeys (login → transfer → confirmation) that map cleanly to ticket ACs — without VPN or product credentials.
