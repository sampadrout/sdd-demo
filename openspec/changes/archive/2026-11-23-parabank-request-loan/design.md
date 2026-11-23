# Design: SDD-2 ParaBank request loan

## Context

See proposal.md — Why. Transfer-funds journey already proves the stack (`auth`, ui-map, App Actions). Request Loan is a new capability on the same ParaBank shell.

## Goals / Non-Goals

**Goals:**
- One journey `it()` covering S-1–S-4 after register/login setup
- Reuse `auth` for unique-user registration; add `request-loan` App Action only
- Assert Approved/Denied (and outcome details) via visible text, not CSS

**Non-Goals:**
- Transfer Funds, Bill Pay, Admin DB reset
- Forcing both Approved and Denied in one run (decision depends on amount vs balance)
- Visual / performance SLAs

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Structure | **Journey** (one `it` spanning S-1–S-4) | Matches SDD-2 automation notes and transfer-funds pattern |
| Auth | Reuse `auth.register` + Faker unique user | Shared `john`/`demo` is flaky; ticket prefers unique registration |
| Selectors | Discover on live Request Loan page before coding | Constitution: never guess; confirm via `/discover-selectors` |
| Outcome assert | Match "Approved" / "Denied" (and account id / denial copy) | Ticket: business outcome text, not styling |

## Runtime discovery (confirmed via Cypress MCP live 2026-11-23)

**Pages inspected**
- Register: `…/register.htm` (reuse existing auth selectors)
- Request Loan: `https://parabank.parasoft.com/parabank/requestloan.htm` (after unique registration `loanmwtgiuaa`)

**Method:** `project-0-sdd-demo-cypress` → `cypress_live_launch` → register → navigate → `cypress_live_discover_forms` / `cypress_live_discover_interactive` / evaluate → Apply Now $100 / $10.

**Live sample outcome:** heading "Loan Request Processed", `#loanStatus` = Approved, provider "Wealth Securities Dynamic Loans (WSDL)", `#newAccountId` = 72618.

**Confirmed controls** (in `parabank.selectors.ts`)

| Control | Selector |
|---|---|
| Request Loan nav | `#leftPanel a[href*="requestloan.htm"]` |
| Form panel | `#requestLoanForm` (wrapper div; inner `<form>` has no id) |
| Heading | `#requestLoanForm h1.title` → "Apply for a Loan" |
| Loan amount | `input#amount` |
| Down payment | `input#downPayment` |
| From account | `select#fromAccountId` (reuse `fromAccountSelect`) |
| Apply Now | `#requestLoanForm input[type="button"][value="Apply Now"]` (type=`button`, not submit) |
| Result panel | `#requestLoanResult` |
| Result heading | `#requestLoanResult h1.title` → "Loan Request Processed" |
| Loan provider | `#loanProviderName` |
| Response date | `#responseDate` |
| Status | `#loanStatus` → `Approved` or `Denied` |
| Approved block | `#loanRequestApproved` (+ `#newAccountId`) |
| Denied block | `#loanRequestDenied` (+ `p.error` denial copy) |
| Error panel | `#requestLoanError` |

**Behavior notes**
- Apply Now is AJAX (`type=button`); form panel hides and `#requestLoanResult` shows.
- Approved: provider "Wealth Securities Dynamic Loans (WSDL)", `#loanStatus` = Approved, `#newAccountId` link set.
- Denial: `#loanRequestDenied` + `p.error` (not exercised this run; panel present in DOM).

## Layers

- Selectors → extend `libs/ui-map/src/lib/parabank.selectors.ts`
- App Actions → reuse `auth`; add `libs/actions/src/lib/features/request-loan/main.ts`
- Spec → `cypress/e2e/request-loan.cy.ts` (`@jira SDD-2`, `@spec S-1`–`S-4`)

## Risks / Trade-offs

- [ParaBank approval threshold depends on amount/down payment/balance] → Use modest amounts relative to seeded balance; assert whichever decision appears, with branch for Approved vs Denied detail checks
- [Shared demo DB resets mid-run] → Unique registered user per run
- [Apply Now is `type=button` with jQuery AJAX] → App Action must click that button and wait on `#requestLoanResult` / `#loanStatus`, not a form submit
- [Denial path not live-sampled this run] → App Action should branch on `#loanStatus` text and assert Approved vs Denied blocks accordingly
