# Tasks

## 1. Discovery & selectors

- [x] 1.1 Confirm Request Loan controls on live ParaBank (`requestloan.htm`) via `/discover-selectors` and record selectors in design.md
- [x] 1.2 Add confirmed Request Loan selectors to `libs/ui-map/src/lib/parabank.selectors.ts` and verify the file exports compile

## 2. App Actions

- [x] 2.1 Confirm reuse of `auth.register` / login for journey setup (no new auth API)
- [x] 2.2 Add `libs/actions/src/lib/features/request-loan/main.ts` (open form, submit request, assert Approved/Denied + outcome details) and verify it imports selectors only from ui-map

## 3. Journey spec

- [x] 3.1 Author `cypress/e2e/request-loan.cy.ts` as one `it()` spanning S-1–S-4 with `@jira SDD-2` / `@spec` tags and `cy.log('S-n')` markers
- [x] 3.2 Run the journey against ParaBank and fix failures until Approved/Denied business text assertions pass

## Workflow follow-up

- Archive with `/opsx:archive` after the journey is green
- Ratify into `openspec/specs/request-loan/`
