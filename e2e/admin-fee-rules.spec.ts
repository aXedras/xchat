import { expect, test } from "@playwright/test";
import { clearSeedScenario, setSeedScenario } from "./fixtures/seedScenario";
import { login } from "./support/auth";

async function authenticateAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();

  await expect(page.getByRole("tab", { name: "Customer Fees" })).toBeEnabled();
  await page.getByRole("tab", { name: "Customer Fees" }).click();
  await expect(page.getByText("Customer Fee Matrix")).toBeVisible();
}

test.describe("Admin fee rules", () => {
  test.beforeEach(async ({ page }) => {
    await clearSeedScenario(page);
    await setSeedScenario(page, "default");
    await page.addInitScript(() => {
      globalThis.localStorage.setItem("api_token", "e2e-admin-token");
      globalThis.localStorage.removeItem("xchat.feeProfiles");
    });

    await login(page);
    await authenticateAdmin(page);
  });

  test("exports fee profiles as JSON and CSV", async ({ page }) => {
    const [jsonDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export JSON" }).click(),
    ]);

    expect(jsonDownload.suggestedFilename()).toBe("xchat-fee-profiles.json");

    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);

    expect(csvDownload.suggestedFilename()).toBe("xchat-fee-profiles.csv");
  });

  test("imports fee profile JSON and renders imported rule", async ({ page }) => {
    const importedProfiles = [
      {
        company: "Argor-Heraeus",
        rules: [
          {
            id: "imported-e2e-rule",
            label: "E2E Imported Fee",
            type: "bps",
            value: 45,
            priority: 500,
            productClass: "gold",
            minimumQuantity: 2,
            validFrom: "2026-03-01",
            validTo: "2026-12-31",
            active: true,
            currency: "CHF",
          },
        ],
      },
    ];

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import JSON" }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: "fee-profiles-import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importedProfiles), "utf-8"),
    });

    await expect(page.getByText("Fee profiles imported successfully")).toBeVisible();
    await expect(page.locator('input[value="E2E Imported Fee"]')).toBeVisible();
    await expect(page.locator('input[value="45"]')).toBeVisible();
  });
});

test.describe("Admin fee rules – validation", () => {
  test.beforeEach(async ({ page }) => {
    await clearSeedScenario(page);
    await setSeedScenario(page, "default");
    await page.addInitScript(() => {
      globalThis.localStorage.setItem("api_token", "e2e-admin-token");
      globalThis.localStorage.removeItem("xchat.feeProfiles");
    });

    await login(page);
    await authenticateAdmin(page);
    // Start with a fresh rule
    await page.getByRole("button", { name: "Add Fee Rule" }).click();
  });

  test("shows error and blocks save when label is empty", async ({ page }) => {
    // Clear the default label
    const labelInput = page.locator('input[placeholder="Handling Fee"]').last();
    await labelInput.clear();

    await expect(page.locator('[role="alert"]').filter({ hasText: /Label is required/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Fee Rules" })).toBeDisabled();
  });

  test("shows error and blocks save when value is negative", async ({ page }) => {
    // Scope to the last rule card (the one just added) and pick the value input (first step=0.01 input)
    const lastRuleCard = page.locator('div.rounded-md.border.bg-background.p-3').last();
    const valueInput = lastRuleCard.locator('input[type="number"][step="0.01"][min="0"]').first();
    await valueInput.fill("-5");
    await valueInput.blur();

    await expect(page.locator('[role="alert"]').filter({ hasText: /Value must be >= 0/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Fee Rules" })).toBeDisabled();
  });

  test("shows error and blocks save when validFrom is after validTo", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(-2).fill("2026-12-31"); // Valid From (last rule, second-to-last date)
    await dateInputs.nth(-1).fill("2026-01-01"); // Valid To (last rule, last date)
    await dateInputs.nth(-1).blur();

    await expect(page.locator('[role="alert"]').filter({ hasText: /Valid From must be on or before Valid To/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Fee Rules" })).toBeDisabled();
  });

  test("save is re-enabled after fixing a validation error", async ({ page }) => {
    // Introduce an error
    const labelInput = page.locator('input[placeholder="Handling Fee"]').last();
    await labelInput.clear();
    await expect(page.getByRole("button", { name: "Save Fee Rules" })).toBeDisabled();

    // Fix it
    await labelInput.fill("Corrected Fee");
    await expect(page.getByRole("button", { name: "Save Fee Rules" })).toBeEnabled();
  });
});
