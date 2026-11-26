import { ParaBankSelectors as S, ParaBankRoles as R } from '@sdd/parabank-ui-map';
import { byRole } from '../../support/by-role';

export type LoanRequest = {
  amount: string;
  downPayment: string;
  /** 0-based option index for from-account (default first). */
  fromIndex?: number;
};

/**
 * Request Loan App Actions — apply for a loan and assert Approved/Denied outcomes.
 */
export const requestLoan = {
  assertFormVisible() {
    cy.get(S.requestLoanForm, { timeout: 15000 }).should('be.visible');
    cy.get(S.requestLoanHeading).should('contain.text', 'Apply for a Loan');
    cy.get(S.loanAmountInput).should('be.visible');
    cy.get(S.loanDownPaymentInput).should('be.visible');
    cy.get(S.fromAccountSelect).should('be.visible');
  },

  request({ amount, downPayment, fromIndex = 0 }: LoanRequest) {
    cy.get(S.fromAccountSelect)
      .find('option')
      .should('have.length.at.least', 1)
      .then(($options) => {
        const from = $options.eq(fromIndex).val() as string;
        cy.get(S.fromAccountSelect).select(from);
      });

    cy.get(S.loanAmountInput).clear().type(amount);
    cy.get(S.loanDownPaymentInput).clear().type(downPayment);
    byRole(R.loanApplyButton).click();
  },

  assertDecision() {
    cy.get(S.requestLoanResult, { timeout: 15000 }).should('be.visible');
    cy.get(S.requestLoanResultHeading).should(
      'contain.text',
      'Loan Request Processed',
    );
    cy.get(S.loanStatus)
      .invoke('text')
      .then((status) => {
        const normalized = status.trim();
        expect(normalized, 'loan decision text').to.be.oneOf([
          'Approved',
          'Denied',
        ]);

        if (normalized === 'Approved') {
          cy.get(S.loanRequestApproved).should('be.visible');
          cy.get(S.loanProviderName).invoke('text').should('match', /\S/);
          cy.get(S.loanNewAccountId)
            .should('be.visible')
            .invoke('text')
            .should('match', /\d+/);
        } else {
          cy.get(S.loanRequestDenied).should('be.visible');
          cy.get(S.loanDeniedMessage)
            .should('be.visible')
            .invoke('text')
            .should('match', /\S/);
        }
      });
  },
};
