# Design: DEMO-1 ParaBank transfer funds

## Target

- App: https://parabank.parasoft.com/parabank
- Journey structure: one `it()` covering S-1–S-4

## Runtime discovery (confirmed from live HTML / known ParaBank DOM)

| Control | Selector |
|---|---|
| Username | `input[name="username"]` |
| Password | `input[name="password"]` |
| Log In | `input[type="submit"][value="Log In"]` |
| Accounts overview | `#accountTable` / `#showOverview` |
| Transfer Funds nav | `#leftPanel a` text "Transfer Funds" |
| Amount | `input#amount` |
| From account | `select#fromAccountId` |
| To account | `select#toAccountId` |
| Transfer submit | `#transferForm input[type="submit"]` |
| Result | `#showResult` with "Transfer Complete!" |

## Data strategy

Register a unique user via Faker each run (ParaBank shared `john`/`demo` can be flaky / DB-reset dependent). Registration seeds two accounts which enables from→to transfer.

## Layers

- Selectors → `libs/ui-map/src/lib/parabank.selectors.ts`
- App Actions → `auth`, `accounts`, `transfer-funds`
- Spec → `cypress/e2e/transfer-funds.cy.ts`
