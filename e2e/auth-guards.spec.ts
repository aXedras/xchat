import { expect, test } from "@playwright/test";
import { login } from "./support/auth";

test.describe("Auth guards", () => {
  test("redirects unauthenticated users away from protected routes", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "xChat" })).toBeVisible();
  });

  test("clears app auth state on logout", async ({ page }) => {
    await login(page);

    await page.getByRole("button", { name: "Open user menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/$/);
  });
});