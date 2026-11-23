/**
 * ParaBank selector map.
 * Confirmed against https://parabank.parasoft.com/parabank (public demo).
 * Prefer name/id attributes over brittle CSS.
 */
export const ParaBankSelectors = {
  // Auth / registration
  usernameInput: 'input[name="username"]',
  passwordInput: 'input[name="password"]',
  loginSubmit: 'input[type="submit"][value="Log In"]',
  registerLink: '#loginPanel a[href*="register.htm"]',
  customerForm: '#customerForm',
  firstNameInput: 'input[name="customer.firstName"]',
  lastNameInput: 'input[name="customer.lastName"]',
  addressInput: 'input[name="customer.address.street"]',
  cityInput: 'input[name="customer.address.city"]',
  stateInput: 'input[name="customer.address.state"]',
  zipInput: 'input[name="customer.address.zipCode"]',
  phoneInput: 'input[name="customer.phoneNumber"]',
  ssnInput: 'input[name="customer.ssn"]',
  registerUsernameInput: 'input[name="customer.username"]',
  registerPasswordInput: 'input[name="customer.password"]',
  confirmPasswordInput: 'input[name="repeatedPassword"]',
  registerSubmit: '#customerForm input[type="submit"]',

  // Post-login shell
  leftPanel: '#leftPanel',
  accountsOverviewHeading: '#showOverview h1.title',
  accountTable: '#accountTable',
  logoutLink: '#leftPanel a[href*="logout.htm"]',

  // Transfer funds
  transferFundsNav: '#leftPanel a[href*="transfer.htm"]',
  transferForm: '#transferForm',
  transferAmountInput: 'input#amount',
  fromAccountSelect: 'select#fromAccountId',
  toAccountSelect: 'select#toAccountId',
  transferSubmit: '#transferForm input[type="submit"]',
  transferResult: '#showResult',
  transferResultHeading: '#showResult h1.title',
} as const;
