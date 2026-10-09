import { defineConfig, devices } from '@playwright/test';

/** Records the training video: `npm run training-video` (not part of the normal test run). */
const PORT = 4322;
export default defineConfig({
  testDir: './training',
  testMatch: /record-training-video\.spec\.ts/,
  timeout: 20 * 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { actionTimeout: 10_000, baseURL: `http://127.0.0.1:${PORT}`, ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
  webServer: { command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`, url: `http://127.0.0.1:${PORT}`, reuseExistingServer: true, timeout: 60_000 },
});
