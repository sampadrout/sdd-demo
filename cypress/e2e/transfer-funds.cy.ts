import { faker } from '@faker-js/faker';
import { auth } from '../../libs/actions/src/lib/features/auth/main';
import { accounts } from '../../libs/actions/src/lib/features/accounts/main';
import { transferFunds } from '../../libs/actions/src/lib/features/transfer-funds/main';

/**
 * @jira DEMO-1
 * @spec S-1
 * @spec S-2
 * @spec S-3
 * @spec S-4
 */
describe('Transfer Funds', () => {
  it('S-1–S-4 registers, opens Transfer Funds, and completes a transfer', () => {
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
      username: `sdd${stamp}`.slice(0, 20),
      password: `Pw${faker.string.alphanumeric(10)}`,
    };
    const amount = '25.00';

    cy.log('S-1 register + land authenticated');
    auth.register(customer);
    auth.assertNoRegistrationError();
    auth.assertRegistered(customer.username);
    // Fresh registration may show Welcome first — open overview via left nav if needed.
    cy.get('body').then(($body) => {
      if ($body.find('#accountTable').length === 0) {
        cy.contains('#leftPanel a', 'Accounts Overview').click();
      }
    });
    accounts.assertOverviewVisible();

    cy.log('S-2 open Transfer Funds');
    accounts.openTransferFunds();
    transferFunds.assertFormVisible();

    cy.log('S-3 submit transfer');
    transferFunds.transfer({ amount });

    cy.log('S-4 assert Transfer Complete');
    transferFunds.assertTransferComplete(amount);
  });
});
