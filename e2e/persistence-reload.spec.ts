import { expect, test } from "@playwright/test";
import { clearSeedScenario, setSeedScenario } from "./fixtures/seedScenario";
import { login } from "./support/auth";

test.describe("Persistence across reload", () => {
  test.beforeEach(async ({ page }) => {
    await clearSeedScenario(page);
    await setSeedScenario(page, "default");
    await page.goto("/");
    await page.evaluate(() => {
      globalThis.localStorage.removeItem("xchat.messages.v1");
      globalThis.localStorage.removeItem("xchat.quote-workflow.v1");
    });
    await login(page);
    await page.getByText("Argor-Heraeus").first().click();
    await expect(page.getByText("Live ask context")).toBeVisible();
  });

  test("keeps sent messages and booked deals after refresh", async ({ page }) => {
    await page.getByPlaceholder("Type a message...").fill("Follow-up after the RFQ");
    await page.getByPlaceholder("Type a message...").press("Enter");
    await expect(page.getByText("Follow-up after the RFQ").first()).toBeVisible();

    const contextPanel = page.getByRole("complementary");
    await contextPanel.getByRole("button", { name: "Send Quote" }).click();
    await contextPanel.getByRole("button", { name: "Accept As Deal" }).click();
    await expect(contextPanel.getByRole("button", { name: "Deal Booked" }).first()).toBeVisible();
    await expect(page.getByText("Deal booked with Jane Smith").first()).toBeVisible();

    await page.reload();
    await page.getByText("Argor-Heraeus").first().click();

    await expect(page.getByText("Follow-up after the RFQ").first()).toBeVisible();
    await expect(page.getByText("Deal booked with Jane Smith").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Deal Booked" }).first()).toBeVisible();
  });
});