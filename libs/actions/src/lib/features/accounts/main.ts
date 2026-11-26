import { ParaBankSelectors as S } from '../../../../../ui-map/src/lib/parabank.selectors';
import { ParaBankRoles as R } from '../../../../../ui-map/src/lib/parabank.roles';
import { byRole } from '../../support/by-role';

/**
 * Accounts App Actions — overview and navigation shell.
 */
export const accounts = {
  assertOverviewVisible() {
    cy.get(S.accountTable, { timeout: 20000 }).should('be.visible');
    cy.get(S.accountsOverviewHeading).should('contain.text', 'Accounts Overview');
  },

  openOverview() {
    byRole(R.accountsOverviewNav).click();
  },

  openTransferFunds() {
    byRole(R.transferFundsNav).should('be.visible').click();
  },

  openRequestLoan() {
    byRole(R.requestLoanNav).should('be.visible').click();
  },
};
