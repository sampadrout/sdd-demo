import { ParaBankSelectors as S } from '../../../../../ui-map/src/lib/parabank.selectors';
import { ParaBankRoles as R } from '../../../../../ui-map/src/lib/parabank.roles';
import { byRole } from '../../support/by-role';

export type CustomerRegistration = {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  ssn: string;
  username: string;
  password: string;
};

/**
 * Auth App Actions — login and register against ParaBank.
 */
export const auth = {
  visitHome() {
    cy.visit('/index.htm');
  },

  login(username: string, password: string) {
    cy.get(S.usernameInput).clear().type(username);
    cy.get(S.passwordInput).clear().type(password, { log: false });
    byRole(R.loginSubmit).click();
  },

  register(customer: CustomerRegistration) {
    cy.visit('/register.htm');
    cy.get(S.customerForm).should('be.visible');
    cy.get(S.firstNameInput).clear().type(customer.firstName);
    cy.get(S.lastNameInput).clear().type(customer.lastName);
    cy.get(S.addressInput).clear().type(customer.address);
    cy.get(S.cityInput).clear().type(customer.city);
    cy.get(S.stateInput).clear().type(customer.state);
    cy.get(S.zipInput).clear().type(customer.zipCode);
    cy.get(S.phoneInput).clear().type(customer.phone);
    cy.get(S.ssnInput).clear().type(customer.ssn);
    cy.get(S.registerUsernameInput).clear().type(customer.username);
    cy.get(S.registerPasswordInput).clear().type(customer.password, { log: false });
    cy.get(S.confirmPasswordInput).clear().type(customer.password, { log: false });
    byRole(R.registerSubmit).click();
  },

  /**
   * Register once and cache the authenticated session (`cy.session`).
   * Later calls with the same customer (a test retry, another test, or another spec
   * in the same run via `cacheAcrossSpecs`) restore cookies instead of re-registering.
   * Leaves the browser on the Accounts Overview. Use `register()` directly when the
   * journey itself covers registration.
   */
  session(customer: CustomerRegistration) {
    cy.session(
      ['parabank', customer.username],
      () => {
        auth.register(customer);
        auth.assertNoRegistrationError();
        auth.assertRegistered(customer.username);
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.request({ url: '/overview.htm', failOnStatusCode: false })
            .its('body')
            .should('include', 'Accounts Overview');
        },
      },
    );
    cy.visit('/overview.htm');
  },

  assertRegistered(username: string) {
    // Success lands on a Welcome heading; also accept Accounts Overview if session continues.
    cy.get('body', { timeout: 20000 }).should(($body) => {
      const text = $body.text();
      const welcomed = new RegExp(`Welcome\\s+${username}`, 'i').test(text);
      const overview = $body.find('#accountTable').length > 0;
      expect(welcomed || overview, `registered session for ${username}`).to.eq(true);
    });
  },

  assertNoRegistrationError() {
    cy.get('body').should(($body) => {
      expect($body.text()).to.not.include('This username already exists');
      expect($body.text()).to.not.match(/error occurred/i);
    });
  },
};
