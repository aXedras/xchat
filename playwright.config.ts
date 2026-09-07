import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

function readEnvFromExample(
  name:
    | "VITE_DEMO_EMAIL"
    | "VITE_DEMO_PASSWORD"
    | "VITE_VENDOR_ADMIN_EMAIL"
    | "VITE_VENDOR_ADMIN_PASSWORD",
) {
  const envExample = readFileSync(
    new URL("./.env.example", import.meta.url),
    "utf8",
  );
  const match = envExample.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match?.[1]) {
    throw new Error(`Missing required ${name} entry in .env.example`);
  }

  return match[1].trim();
}

const demoAuth = {
  email: process.env.VITE_DEMO_EMAIL || readEnvFromExample("VITE_DEMO_EMAIL"),
  password:
    process.env.VITE_DEMO_PASSWORD || readEnvFromExample("VITE_DEMO_PASSWORD"),
} as const;

const vendorAdminAuth = {
  email:
    process.env.VITE_VENDOR_ADMIN_EMAIL ||
    readEnvFromExample("VITE_VENDOR_ADMIN_EMAIL"),
  password:
    process.env.VITE_VENDOR_ADMIN_PASSWORD ||
    readEnvFromExample("VITE_VENDOR_ADMIN_PASSWORD"),
} as const;

const playwrightPort = process.env.PLAYWRIGHT_PORT || "4173";
const playwrightBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${playwrightPort}`;

process.env.VITE_DEMO_EMAIL = demoAuth.email;
process.env.VITE_DEMO_PASSWORD = demoAuth.password;
process.env.VITE_VENDOR_ADMIN_EMAIL = vendorAdminAuth.email;
process.env.VITE_VENDOR_ADMIN_PASSWORD = vendorAdminAuth.password;

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
      VITE_ENABLE_DEMO_AUTH: "true",
      VITE_SUPABASE_URL: localSupabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: localSupabaseKey,
      VITE_DEMO_EMAIL: demoAuth.email,
      VITE_DEMO_PASSWORD: demoAuth.password,
      VITE_VENDOR_ADMIN_EMAIL: vendorAdminAuth.email,
      VITE_VENDOR_ADMIN_PASSWORD: vendorAdminAuth.password,
    },
    url: playwrightBaseUrl,
    timeout: 120000,
    reuseExistingServer: false,
  },
});
