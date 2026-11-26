import { defineConfig } from 'cypress';

/**
 * Target is the public ParaBank host. Override with CYPRESS_BASE_URL (or BASE_URL)
 * to point at a different deployment.
 */
const baseUrl =
  process.env.CYPRESS_BASE_URL ||
  process.env.BASE_URL ||
  'https://parabank.parasoft.com/parabank';

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    // Retry once in `cypress run` only: the shared public ParaBank demo is occasionally flaky.
    // `cypress open` (and tap sessions) never retry, so local failures stay visible.
    retries: { runMode: 1, openMode: 0 },
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 60000,
    viewportWidth: 1280,
    viewportHeight: 800,
  },
});
