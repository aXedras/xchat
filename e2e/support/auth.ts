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

async function loginWithCredentials(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.goto("/");

  const emailInput = page.getByLabel("Email");
  const passwordInput = page.getByLabel("Password");
  const signInButton = page.getByRole("button", {
    name: "Sign in",
    exact: true,
  });

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(signInButton).toBeVisible();

  await emailInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  await signInButton.click();
}

export async function login(page: Page) {
  await loginWithCredentials(page, demoAuth);
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginAsVendorAdmin(page: Page) {
  await loginWithCredentials(page, vendorAdminAuth);
  await expect(page).toHaveURL(/\/dashboard$/);
}
