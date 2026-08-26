import { defineConfig, test as base, expect } from '@playwright/test';
import { assertLocalURL } from './packages/test-support/src/harness.js';

const baseURL = process.env.AUTOED_TEST_BASE_URL ?? 'http://127.0.0.1:43187';
assertLocalURL(baseURL);

// UI tests import this fixture; routes deny external requests including redirects.
export const syntheticTest = base.extend({
  context: async ({ context }, use) => {
    await context.route('**/*', async route => {
      try { assertLocalURL(route.request().url()); } catch { await route.abort('blockedbyclient'); return; }
      await route.continue();
    });
    await use(context);
  },
});
export { expect };
export default defineConfig({
  testDir: './tests/ui',
  timeout: 30_000,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  use: {
    baseURL, browserName: 'chromium', trace: 'off', video: 'off', screenshot: 'off',
    serviceWorkers: 'block',
    // Also constrain tests that accidentally import the stock fixture: non-local
    // browser traffic is sent to a closed local proxy, never to a school host.
    proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1,[::1]' },
  },
});
