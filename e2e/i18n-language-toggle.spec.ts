import { test, expect, type Page } from "@playwright/test";

test.setTimeout(120000);

const alice = { email: "alice@xchat.test.local", password: "Al1ce-Test-Pw", name: "Alice Metal" };

async function loginAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("session survives a reload and the language choice persists", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginAs(page, alice);

  // English is the default language.
  await expect(page.getByText("Messages", { exact: true })).toBeVisible({ timeout: 10000 });

  // Switch to German via the flag toggle.
  await page.getByTestId("language-toggle").click();
  await page.locator('[role="menuitem"]:has-text("Deutsch")').click();
  await expect(page.getByText("Nachrichten", { exact: true })).toBeVisible({ timeout: 10000 });

  // A full reload restores both the session and the selected language.
  await page.reload();
  await expect(page.getByText("Nachrichten", { exact: true })).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem("xchat.locale"))).toBe("de");

  await context.close();
});
