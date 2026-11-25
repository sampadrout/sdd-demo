# SDD-3 — ParaBank Bill Pay

| Field | Value |
|---|---|
| Issue | **[SDD-3](https://sampadrout.atlassian.net/browse/SDD-3)** |
| Project | sdd-demo (`SDD`) |
| Summary | ParaBank: customer can pay a bill from an account |

## Acceptance criteria (for `/from-jira`)

1. Authenticated customer opens Bill Pay from account services.
2. Enters payee details + amount and chooses from-account.
3. Submit accepts the payment and shows confirmation.
4. Confirmation shows payee name, amount, and from-account.

## Suggested demo flow

```text
/from-jira SDD-3
/discover-selectors /billpay.htm "Bill Pay form"
/openspec-apply-change
/openspec-archive-change
```
