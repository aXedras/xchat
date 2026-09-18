import { defineConfig, devices } from "@playwright/test";

const playwrightPort = process.env.PLAYWRIGHT_PORT || "4173";
const playwrightBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${playwrightPort}`;

const localSupabaseUrl =
  process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321";
const localSupabaseKey =
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: playwrightBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${playwrightPort} --strictPort`,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: localSupabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: localSupabaseKey,
    },
    url: playwrightBaseUrl,
    timeout: 120000,
    reuseExistingServer: false,
  },
});
