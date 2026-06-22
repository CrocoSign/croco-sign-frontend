import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against a REAL backend (no network mocking).
 *
 * Prerequisite: the croco-sign backend must be running and reachable on
 * http://localhost:8000 (the host:port the app derives for its API base).
 * See croco-sign-backend/ — `docker compose up`, or a local run with Redis +
 * CROCO_DEEPL_KEY. The translation tests use the registered `mock` PJM model, so
 * no signing model/GPU is required, but DeepL (stage 2) and the segment clip
 * stream (HuggingFace) are exercised for real.
 *
 * Run with: npm run test:e2e:real
 */
export default defineConfig({
  testDir: './e2e/real',
  /* Real network + a 1.3 MB segment clip stream from HF → be generous. */
  timeout: 60 * 1000,
  expect: { timeout: 15 * 1000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /* Serial: these share one real backend and its data. */
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  /* Start only the frontend; the backend is assumed already running on :8000. */
  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run dev',
    port: process.env.CI ? 4173 : 5173,
    reuseExistingServer: true,
  },
})
