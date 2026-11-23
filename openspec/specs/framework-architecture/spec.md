# Framework Architecture

## Purpose

Define the layered architecture so tests express business intent and stay maintainable.

## Requirements

### Requirement: Layered dependency direction
Automation SHALL flow: Test -> Feature -> App Action -> Command -> UI/API -> Application.

#### Scenario: Test invokes an App Action
- **WHEN** a `.cy.ts` test needs to perform a workflow
- **THEN** it calls an App Action (e.g. `transferFunds.transfer()`)
- **AND** it does not call raw `cy.get`/`cy.click` for business steps

### Requirement: Page Objects are prohibited
The framework SHALL NOT use the Page Object Model.

#### Scenario: New workflow without a page object
- **WHEN** an engineer adds support for a new screen
- **THEN** they add/extend an App Action
- **AND** no `*.page.ts` Page Object class is introduced

### Requirement: Selectors are encapsulated
Selectors SHALL live only in `libs/ui-map`. Tests SHALL NOT contain selector literals.

#### Scenario: Test contains no selectors
- **WHEN** reviewing a `.cy.ts` file
- **THEN** it references no CSS/`name`/id selector literals for business steps
