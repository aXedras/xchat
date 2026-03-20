import { expect, test } from "@playwright/test";
import { clearSeedScenario, setSeedScenario } from "./fixtures/seedScenario";
import { login } from "./support/auth";

test.describe("Seeded scenario Firma A to Firma B", () => {
  test.beforeEach(async ({ page }) => {
    await clearSeedScenario(page);
    await setSeedScenario(page, "firma-a-firma-b");
    await login(page);
  });

  test("loads seeded chat and seeded deal history", async ({ page }) => {
    await page.getByText("Firma B Metals").first().click();

    await expect(page.getByText("Live ask context")).toBeVisible();
    await expect(page.getByText("Current inbound request from Firma A Trader")).toBeVisible();
    await expect(page.getByText("RFQ").first()).toBeVisible();

    const contextPanel = page.getByRole("complementary");
    await expect(contextPanel.getByText("Deals from prior requests")).toBeVisible();
    await expect(contextPanel.getByText("Gold bars • 8x1KG")).toBeVisible();
  });

  test("applies customer fee rules to quote discussion", async ({ page }) => {
    await page.getByText("Firma B Metals").first().click();

    const contextPanel = page.getByRole("complementary");
    await contextPanel.getByRole("button", { name: "Send Quote" }).click();

    await expect(contextPanel.getByText("Fees applied:")).toBeVisible();
    await expect(contextPanel.getByText("Strategic Service Fee")).toBeVisible();
  });
});
