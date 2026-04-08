import { expect, test } from "@playwright/test";
import { loginAsVendorAdmin } from "./support/auth";

async function connectAdminApi(page: import("@playwright/test").Page) {
  await loginAsVendorAdmin(page);
  await page.goto("/admin");
  await page.getByRole("tab", { name: "API Connection" }).click();
  await page.getByLabel("API Key").fill("demo_key");
  await page.getByLabel("API Secret").fill("demo_secret");
  await page.getByRole("button", { name: "Connect to API" }).click();
  await expect(page.getByText("Status: Connected")).toBeVisible();
}

test.describe("Admin company registration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      globalThis.localStorage.removeItem("xchat.appAuth");
      globalThis.localStorage.removeItem("api_token");
      globalThis.localStorage.removeItem("xchat.adminConnection");
      globalThis.localStorage.removeItem("xchat.registeredCompanies");
    });
  });

  test("registers a company and exposes it in the conversation selector", async ({
    page,
  }) => {
    await connectAdminApi(page);
    await page.getByRole("tab", { name: "Company Registration" }).click();

    await page.getByLabel("Company Name").fill("Aurum Logistics AG");
    await page.getByLabel("Location").fill("Zurich");
    await page.locator("#companyType").click();
    await page.getByRole("option", { name: "Logistics" }).click();
    await page.locator("#userName-0").fill("Nina Keller");
    await page.locator("#userRole-0").click();
    await page.getByRole("option", { name: "Operations" }).click();
    await page.getByRole("button", { name: "Register Company" }).click();

    await expect(
      page.getByText('Company "Aurum Logistics AG" registered with 1 users'),
    ).toBeVisible();

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Start New Conversation" }).click();
    await expect(page.getByText("Aurum Logistics AG")).toBeVisible();
  });

  test("blocks duplicate company registration", async ({ page }) => {
    await connectAdminApi(page);
    await page.getByRole("tab", { name: "Company Registration" }).click();

    await page.getByLabel("Company Name").fill("PAMP");
    await page.getByLabel("Location").fill("Zurich");
    await page.locator("#companyType").click();
    await page.getByRole("option", { name: "Refiner" }).click();

    await expect(
      page.getByText(
        'Company "PAMP" already exists and cannot be registered twice.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Register Company" }),
    ).toBeDisabled();
  });
});
