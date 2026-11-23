import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'https://parabank.parasoft.com/parabank',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 60000,
    viewportWidth: 1280,
    viewportHeight: 800,
  },
});
