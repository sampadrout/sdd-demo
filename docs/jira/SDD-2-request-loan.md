# SDD-2 — ParaBank Request Loan

| Field | Value |
|---|---|
| Issue | **[SDD-2](https://sampadrout.atlassian.net/browse/SDD-2)** |
| Project | sdd-demo (`SDD`) |
| Summary | ParaBank: customer can request a loan and see approval or denial |

## Acceptance criteria (for `/from-jira`)

1. Authenticated customer opens Request Loan from account services.
2. Enters loan amount + down payment and chooses from-account.
3. Submit returns Approved or Denied.
4. Confirmation shows outcome details (new account / denial message).

## Suggested demo flow

```text
/from-jira SDD-2
/discover-selectors /requestloan.htm "Request Loan form"
/opsx:apply
/opsx:archive
```
