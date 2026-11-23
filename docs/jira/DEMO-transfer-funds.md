# Jira ticket — ParaBank Transfer Funds (SDD demo)

| Field | Value |
|---|---|
| Site | https://sampadrout.atlassian.net |
| Project | sdd-demo (`SDD`) |
| Issue | **[SDD-1](https://sampadrout.atlassian.net/browse/SDD-1)** |

## Summary

ParaBank: customer can transfer funds between accounts

## Acceptance criteria → requirements

| AC | Spec |
|---|---|
| Sign in → Accounts Overview | S-1 |
| Open Transfer Funds | S-2 |
| Submit transfer | S-3 |
| Transfer Complete confirmation | S-4 |

## Demo entry point

```text
/from-jira SDD-1
```

Traceability lives on the Cypress journey: `cypress/e2e/transfer-funds.cy.ts` (`@jira SDD-1`, `@spec S-1`–`S-4`).
