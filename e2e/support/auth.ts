import { expect, type Page } from "@playwright/test";

// Seeded in supabase/seed.sql (see there for the source of truth). Logins go
// through Supabase Auth; there is no demo/vendor-admin credential path anymore.
const regularAuth = {
  email: "alice@xchat.test.local",
  password: "Al1ce-Test-Pw",
} as const;

const vendorAdminAuth = {
  email: "admin@xchat.test.local",
  password: "Adm1n-Test-Pw",
} as const;

async function loginWithCredentials(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.goto("/");

  const emailInput = page.getByLabel("Email");
  const passwordInput = page.getByLabel("Password", { exact: true });
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
  await loginWithCredentials(page, regularAuth);
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginAsVendorAdmin(page: Page) {
  await loginWithCredentials(page, vendorAdminAuth);
  await expect(page).toHaveURL(/\/dashboard$/);
}
