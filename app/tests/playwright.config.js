// c2's own config. The whole-repo runner is c4's playwright.config.js at the root.
// Port 5901 is c2's static server (PLAN.md).
const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js/,
  testIgnore: /qa\//,          // app/tests/qa/** is c4's
  timeout: 20000,
  retries: 0,
  reporter: [['list']],
  outputDir: path.join(__dirname, 'results'),
  use: {
    baseURL: 'http://localhost:5901',
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium',
        launchOptions: { args: ['--use-fake-device-for-media-stream'] } } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'python3 -m http.server 5901 -d "' + path.join(__dirname, '..') + '"',
    url: 'http://localhost:5901/index.html',
    reuseExistingServer: true,
  },
});
