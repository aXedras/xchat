import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

function readRequiredEnvFromExample(name: "VITE_DEMO_EMAIL" | "VITE_DEMO_PASSWORD") {
  const envExample = readFileSync(new URL("./.env.example", import.meta.url), "utf8");
  const match = envExample.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match?.[1]) {
    throw new Error(`Missing required ${name} entry in .env.example`);
  }

  return match[1].trim();
}

const demoAuth = {
  email: process.env.VITE_DEMO_EMAIL || readRequiredEnvFromExample("VITE_DEMO_EMAIL"),
  password: process.env.VITE_DEMO_PASSWORD || readRequiredEnvFromExample("VITE_DEMO_PASSWORD"),
} as const;

process.env.VITE_DEMO_EMAIL = demoAuth.email;
process.env.VITE_DEMO_PASSWORD = demoAuth.password;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
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
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    env: {
      ...process.env,
      VITE_DEMO_EMAIL: demoAuth.email,
      VITE_DEMO_PASSWORD: demoAuth.password,
    },
    url: "http://127.0.0.1:4173",
    timeout: 120000,
    reuseExistingServer: false,
  },
});
