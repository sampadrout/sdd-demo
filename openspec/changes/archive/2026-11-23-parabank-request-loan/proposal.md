# Proposal: SDD-2 ParaBank request-loan journey

## Why

SDD-2 asks for Spec-Driven automation of ParaBank Request Loan so a customer can borrow against an account and see an Approved or Denied decision—not another transfer-funds demo.

## What Changes

- Register (or log in) a unique customer as journey setup
- Navigate to Request Loan from account services
- Submit loan amount, down payment, and from-account
- Assert loan decision text (Approved or Denied) and outcome details

## Capabilities

### New Capabilities
- `request-loan`: Customer can request a loan and observe approval or denial with confirmation details

### Modified Capabilities
- _(none)_

## Impact

- New App Action `request-loan`; selectors in `parabank.selectors.ts`
- Reuse existing `auth` (and accounts helpers if needed)
- New Cypress journey `cypress/e2e/request-loan.cy.ts` tagged `@jira SDD-2` / `@spec S-1`–`S-4`
