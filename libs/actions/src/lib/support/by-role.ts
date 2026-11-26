import type { RoleTarget } from '../../../../ui-map/src/lib/parabank.roles';

/**
 * Thin wrapper over `cy.getByRole()` (Cypress 16.2+) for ui-map role targets.
 * Retries like `cy.get()`, so chain assertions/actions directly:
 *   byRole(R.transferSubmit).should('be.visible').click();
 */
export const byRole = (target: RoleTarget) =>
  cy.getByRole(target.role, { name: target.name });
