# Transfer Funds

## Purpose

Customers can move money between their ParaBank accounts and see a confirmation of the transfer.

## Requirements

### Requirement: S-1 Customer can authenticate
A registered customer SHALL be able to sign in with username and password and land on Accounts Overview.

#### Scenario: Successful login
- **WHEN** a registered customer submits valid credentials
- **THEN** the Accounts Overview page is shown
- **AND** the account table is visible

### Requirement: S-2 Customer can open Transfer Funds
An authenticated customer SHALL be able to navigate to the Transfer Funds screen.

#### Scenario: Open transfer screen
- **WHEN** the customer chooses Transfer Funds from the account menu
- **THEN** the Transfer Funds form is displayed

### Requirement: S-3 Customer can submit a transfer
An authenticated customer SHALL be able to transfer an amount from one owned account to another.

#### Scenario: Submit transfer
- **WHEN** the customer enters an amount and selects from/to accounts
- **AND** submits the transfer
- **THEN** the system accepts the request

### Requirement: S-4 Transfer confirmation is shown
After a successful transfer the customer SHALL see a Transfer Complete confirmation that includes the transferred amount.

#### Scenario: Confirmation shown
- **WHEN** a transfer completes successfully
- **THEN** a "Transfer Complete!" confirmation is visible
- **AND** the confirmation reflects the amount transferred
