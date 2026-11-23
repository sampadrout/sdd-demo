import { ParaBankSelectors as S } from '../../../../../ui-map/src/lib/parabank.selectors';

export type TransferRequest = {
  amount: string;
  /** 0-based option index for from-account (default first). */
  fromIndex?: number;
  /** 0-based option index for to-account (default second when available). */
  toIndex?: number;
};

/**
 * Transfer Funds App Actions — move money between owned accounts.
 */
export const transferFunds = {
  assertFormVisible() {
    cy.get(S.transferForm, { timeout: 15000 }).should('be.visible');
    cy.contains('h1.title', 'Transfer Funds').should('be.visible');
  },

  transfer({ amount, fromIndex = 0, toIndex = 1 }: TransferRequest) {
    cy.get(S.fromAccountSelect)
      .find('option')
      .should('have.length.at.least', 1)
      .then(($options) => {
        const from = $options.eq(fromIndex).val() as string;
        const safeToIndex = Math.min(toIndex, $options.length - 1);
        const to = $options.eq(safeToIndex).val() as string;

        // When only one account exists, transfer still works same→same on ParaBank.
        cy.get(S.fromAccountSelect).select(from);
        cy.get(S.toAccountSelect).select(to);
      });

    cy.get(S.transferAmountInput).clear().type(amount);
    cy.get(S.transferSubmit).click();
  },

  assertTransferComplete(amount: string) {
    cy.get(S.transferResult, { timeout: 15000 }).should('be.visible');
    cy.get(S.transferResultHeading).should('contain.text', 'Transfer Complete!');
    // Confirmation copy: "$25.00 has been transferred from account #… to account #…"
    cy.get(S.transferResult).should('contain.text', `$${amount}`);
    cy.get(S.transferResult).should('contain.text', 'has been transferred');
  },
};
