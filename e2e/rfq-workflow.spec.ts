import { expect, test } from "@playwright/test";
import { clearSeedScenario, setSeedScenario } from "./fixtures/seedScenario";
import { login } from "./support/auth";

test.describe("RFQ and deal workflow", () => {
  test.beforeEach(async ({ page }) => {
    await clearSeedScenario(page);
    await setSeedScenario(page, "default");
    await login(page);
    await page.getByText("Argor-Heraeus").first().click();
    await expect(page.getByText("Live ask context")).toBeVisible();
  });

  test("shows prior deal history for the active counterparty", async ({ page }) => {
    await expect(page.getByText("Deals from prior requests")).toBeVisible();
    await expect(page.getByText("Gold bars • 5x1KG")).toBeVisible();
    await expect(page.getByText("Platinum bars • 2x1KG")).toBeVisible();
  });

  test("can quote and convert to a booked deal", async ({ page }) => {
    const contextPanel = page.getByRole("complementary");
    await contextPanel.getByRole("button", { name: "Send Quote" }).click();
    await expect(contextPanel.getByText("Submitted").first()).toBeVisible();

    await contextPanel.getByRole("button", { name: "Accept As Deal" }).click();

    await expect(contextPanel.getByRole("button", { name: "Deal Booked" })).toBeVisible();
    await expect(page.getByText("Deal booked with Jane Smith").first()).toBeVisible();
  });

  test("supports counter and reject flow", async ({ page }) => {
    const contextPanel = page.getByRole("complementary");
    await contextPanel.getByRole("button", { name: "Send Quote" }).click();
    await contextPanel.getByRole("button", { name: "Counter Quote" }).click();
    await expect(contextPanel.getByText("Countered").first()).toBeVisible();

    await contextPanel.getByRole("button", { name: "Reject Quote" }).click();
    await expect(contextPanel.getByText("Rejected").first()).toBeVisible();
  });
});
