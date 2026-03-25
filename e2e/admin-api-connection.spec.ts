import { expect, test } from "@playwright/test";

test.describe("Admin API connection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.evaluate(() => {
      globalThis.localStorage.removeItem("api_token");
      globalThis.localStorage.removeItem("xchat.adminConnection");
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
  });

  test("keeps protected tabs disabled before a connection is established", async ({ page }) => {
    await expect(page.getByText("Status: Disconnected")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Company Registration" })).toBeDisabled();
    await expect(page.getByRole("tab", { name: "Customer Fees" })).toBeDisabled();
  });

  test("shows a deterministic error for invalid credentials", async ({ page }) => {
    await page.getByLabel("API Key").fill("invalid_key");
    await page.getByLabel("API Secret").fill("invalid_secret");
    await page.getByRole("button", { name: "Connect to API" }).click();

    await expect(page.getByText("Status: Error")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid API credentials. Check the API key and secret and try again." })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Company Registration" })).toBeDisabled();
  });

  test("unlocks protected tabs and persists the connection across reloads", async ({ page }) => {
    await page.getByLabel("API Key").fill("demo_key");
    await page.getByLabel("API Secret").fill("demo_secret");
    await page.getByRole("button", { name: "Connect to API" }).click();

    await expect(page.getByText("Status: Connected")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Company Registration" })).toBeEnabled();
    await expect(page.getByRole("tab", { name: "Customer Fees" })).toBeEnabled();

    await page.reload();

    await expect(page.getByText("Status: Connected")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Company Registration" })).toBeEnabled();
    await expect(page.getByRole("tab", { name: "Customer Fees" })).toBeEnabled();
  });
});