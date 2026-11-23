# Request Loan

## Purpose

Customers can request a loan against an owned account and see a clear Approved or Denied decision with confirmation details.

## Requirements

### Requirement: S-1 Customer can open Request Loan
An authenticated customer SHALL be able to open the Request Loan screen from the account services menu.

#### Scenario: Open request loan screen
- **WHEN** an authenticated customer chooses Request Loan from the account menu
- **THEN** the Request Loan form is displayed

### Requirement: S-2 Customer can enter loan details
An authenticated customer SHALL be able to enter a loan amount and a down payment and choose a from-account on the Request Loan form.

#### Scenario: Fill loan request fields
- **WHEN** the customer is on the Request Loan screen
- **THEN** the customer can enter a loan amount and a down payment
- **AND** choose a from-account

### Requirement: S-3 Customer receives a loan decision
When the customer submits a loan request, ParaBank SHALL return a loan decision of Approved or Denied.

#### Scenario: Loan decision returned
- **WHEN** the customer submits a completed loan request
- **THEN** a loan decision of Approved or Denied is shown as business outcome text

### Requirement: S-4 Loan outcome details are shown
On approval the confirmation SHALL show a new account id and/or loan provider details; on denial a clear denial message SHALL be shown.

#### Scenario: Approval confirmation
- **WHEN** a loan request is Approved
- **THEN** the confirmation shows a new account id and/or loan provider details

#### Scenario: Denial message
- **WHEN** a loan request is Denied
- **THEN** a clear denial message is shown
