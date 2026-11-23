import { ParaBankSelectors as S } from '../../../../../ui-map/src/lib/parabank.selectors';

/**
 * Accounts App Actions — overview and navigation shell.
 */
export const accounts = {
  assertOverviewVisible() {
    cy.get(S.accountTable, { timeout: 20000 }).should('be.visible');
    cy.get(S.accountsOverviewHeading).should('contain.text', 'Accounts Overview');
  },

  openTransferFunds() {
    cy.get(S.transferFundsNav).should('be.visible').click();
  },
};
