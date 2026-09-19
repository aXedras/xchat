import { expect, test } from "@playwright/test";
import { login, loginAsVendorAdmin } from "./support/auth";

test.describe("Organization management", () => {
  test("admin sees organizations with their capabilities", async ({ page }) => {
    await loginAsVendorAdmin(page);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Admin Console" }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Organizations" }).click();

    await expect(page.getByRole("heading", { name: "Mine A" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dealer D" })).toBeVisible();

    const mineACard = page
      .locator("div.rounded-lg.border")
      .filter({ has: page.getByRole("heading", { name: "Mine A" }) });
    await expect(mineACard).toContainText("MINE_OPERATOR");

    const refineryBCard = page
      .locator("div.rounded-lg.border")
      .filter({ has: page.getByRole("heading", { name: "Refinery B" }) });
    await expect(refineryBCard).toContainText("REFINER");
    await expect(refineryBCard).toContainText("TRADER");
  });

  test("a non-admin trader cannot access the admin console", async ({ page }) => {
    await login(page);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("tab", { name: "Organizations" })).toHaveCount(0);
  });
});
