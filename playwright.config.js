// Root Playwright config: runs EVERY *.spec.js in the repo (c2's app/tests and c4's app/tests/qa)
// on chromium + webkit, phone (390x844) and desktop (1280x800), against a static server on 5909
// that serves the repo root, so the app is at /app/index.html.
import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.QA_PORT || 5909)
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const desktop = { viewport: { width: 1280, height: 800 } }

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js$/,
  testIgnore: [
    '**/node_modules/**',
    '**/.worktrees/**',
    '.wrangler/**',
    'test-results/**',
    'worker/.wrangler/**',
    'app/tests/app.spec.js' /* c2's suite has its own Playwright install; run it from app/tests */,
  ],
  outputDir: 'test-results',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The app asks for the camera on load; deny it by default so headless runs never hang on a prompt.
    permissions: [],
  },
  webServer: {
    command: `node app/tests/qa/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/PLAN.md`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: [
    { name: 'chromium-phone', use: { ...devices['Desktop Chrome'], ...phone } },
    { name: 'webkit-phone', use: { ...devices['Desktop Safari'], ...phone } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], ...desktop } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], ...desktop } },
  ],
})
