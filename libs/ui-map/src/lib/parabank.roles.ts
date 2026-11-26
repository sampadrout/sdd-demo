/**
 * ParaBank role-based targets for `cy.getByRole()` (Cypress 16.2+).
 *
 * Prefer a role + accessible name over a CSS selector when the element is a
 * native button, link, or heading: it survives markup/ID changes and asserts
 * what a user (and assistive tech) actually sees. Fall back to
 * `parabank.selectors.ts` for form fields and containers that have no stable
 * role/name (ParaBank's inputs are not labelled).
 *
 * Usage in an App Action:
 *   cy.getByRole(R.transferSubmit.role, { name: R.transferSubmit.name }).click();
 *
 * Confirmed against https://parabank.parasoft.com/parabank (public demo).
 */
export type RoleTarget = { readonly role: string; readonly name: string };

export const ParaBankRoles = {
  // Auth / registration
  loginSubmit: { role: 'button', name: 'Log In' },
  registerSubmit: { role: 'button', name: 'Register' },

  // Post-login left navigation
  accountsOverviewNav: { role: 'link', name: 'Accounts Overview' },
  transferFundsNav: { role: 'link', name: 'Transfer Funds' },
  requestLoanNav: { role: 'link', name: 'Request Loan' },

  // Transfer funds
  transferSubmit: { role: 'button', name: 'Transfer' },

  // Request loan
  loanApplyButton: { role: 'button', name: 'Apply Now' },
} as const satisfies Record<string, RoleTarget>;
