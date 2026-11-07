import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  // AI analysis runs for real between submit and the feedback page, so the
  // default 30s per-test budget is too tight for assessment flows.
  timeout: 120_000,
  // `manage.py runserver` is a development server: six browsers hammering it
  // at once makes ordinary requests miss the default 5s assertion budget and
  // fail for no reason. Two workers keeps it honest and stable.
  workers: 2,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: {
      // Lets the voice-mode tests drive MediaRecorder without a real mic or a
      // permission prompt. Chrome feeds a synthetic tone; the backend's STT
      // provider is the fake one in e2e runs, so the transcript is canned.
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      cwd: '.',
    },
  ],
})
