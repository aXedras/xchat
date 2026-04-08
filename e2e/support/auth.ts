import { expect, type Page } from "@playwright/test";

function requireEnv(
  name:
    | "VITE_DEMO_EMAIL"
    | "VITE_DEMO_PASSWORD"
    | "VITE_VENDOR_ADMIN_EMAIL"
    | "VITE_VENDOR_ADMIN_PASSWORD",
) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required Playwright auth environment variable: ${name}`,
    );
  }

  return value;
}

export const demoAuth = {
  email: requireEnv("VITE_DEMO_EMAIL"),
  password: requireEnv("VITE_DEMO_PASSWORD"),
} as const;

export const vendorAdminAuth = {
  email: requireEnv("VITE_VENDOR_ADMIN_EMAIL"),
  password: requireEnv("VITE_VENDOR_ADMIN_PASSWORD"),
} as const;

export async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill(demoAuth.email);
  await page.getByLabel("Password").fill(demoAuth.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginAsVendorAdmin(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill(vendorAdminAuth.email);
  await page.getByLabel("Password").fill(vendorAdminAuth.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
