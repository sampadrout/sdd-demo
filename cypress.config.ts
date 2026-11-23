import { defineConfig } from 'cypress';

/**
 * Default target is the public ParaBank host (local demos / discovery).
 * CI overrides via CYPRESS_BASE_URL to a local Docker instance so GitHub
 * Actions IPs are not blocked by Cloudflare Turnstile on the public site.
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
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 60000,
    viewportWidth: 1280,
    viewportHeight: 800,
  },
});
