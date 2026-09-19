import { expect, test } from "@playwright/test";
import { login } from "./support/auth";

test.describe("RFQ V2 composer", () => {
  test("opens the macro launcher via /rfq and exposes the four-tab composer", async ({
    page,
  }) => {
    await login(page);

    await page.getByRole("button", { name: "Start New Conversation" }).click();
    await page.getByRole("button", { name: /Eve Dealer/ }).click();
    await page.getByPlaceholder("Write your first message...").fill("hello");
    await page.getByRole("button", { name: /^Send/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByText("Eve Dealer", { exact: true }).first().click();

    const input = page.getByPlaceholder("Type a message...");
    await expect(input).toBeVisible();
    await input.fill("/rfq");
    await input.press("Enter");

    await expect(page.getByText("Choose a transaction")).toBeVisible();
    for (const code of [
      "REFINE_AND_RETURN",
      "SELL_DORE",
      "REFINE_AND_SELL",
      "BUY_REFINED_METAL",
      "SELL_REFINED_METAL",
      "FABRICATE_METAL",
      "BUY_FEEDSTOCK",
    ]) {
      await expect(page.getByText(code, { exact: true })).toBeVisible();
    }

    await page.getByRole("button", { name: /SELL_DORE/ }).click();

    await expect(page.getByRole("tab", { name: /Commercial/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Material/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Assay/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Logistics/ })).toBeVisible();
  });
});
