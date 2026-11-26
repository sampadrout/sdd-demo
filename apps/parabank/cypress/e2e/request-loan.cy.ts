import { faker } from '@faker-js/faker';
import { auth, accounts, requestLoan } from '@sdd/parabank-actions';

/**
 * @jira SDD-2
 * @spec S-1
 * @spec S-2
 * @spec S-3
 * @spec S-4
 */
describe('Request Loan', () => {
  // Built once per spec (not per attempt) so a retry restores the cached session
  // instead of registering a second customer.
  const stamp = `${Date.now()}${faker.string.numeric(4)}`;
  const customer = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    address: faker.location.streetAddress(),
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    phone: faker.string.numeric(10),
    ssn: faker.string.numeric(9),
    // Timestamp keeps usernames unique on ParaBank's shared demo DB.
    username: `loan${stamp}`.slice(0, 20),
    password: `Pw${faker.string.alphanumeric(10)}`,
  };
  // Modest amounts relative to a freshly registered account balance.
  const amount = '100';
  const downPayment = '10';

  it('S-1–S-4 opens Request Loan and receives a loan decision', () => {
    cy.log('setup: authenticated session for a unique customer (cy.session)');
    auth.session(customer);
    accounts.assertOverviewVisible();

    cy.log('S-1 open Request Loan');
    accounts.openRequestLoan();
    requestLoan.assertFormVisible();

    cy.log('S-2 enter loan amount, down payment, from-account');
    cy.log('S-3 submit loan request');
    requestLoan.request({ amount, downPayment });

    cy.log('S-4 assert Approved/Denied outcome details');
    requestLoan.assertDecision();
  });
});
