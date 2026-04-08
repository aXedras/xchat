import { expect, type Page } from "@playwright/test";
import { loginAsVendorAdmin } from "./auth";

const ADMIN_CONNECTION_STORAGE_KEY = "xchat.adminConnection";

export type AdminTabName =
  | "System Settings"
  | "API Connection"
  | "Company Registration"
  | "Customer Fees";

export async function clearAppStorage(page: Page, keys: string[]) {
  await page.goto("/");
  await page.evaluate((storageKeys) => {
    storageKeys.forEach((key) => {
      globalThis.localStorage.removeItem(key);
    });
  }, keys);
}

export async function seedMockAdminConnection(
  page: Page,
  token = "e2e-admin-token",
) {
  await page.evaluate(
    ({ nextToken, connectedAt, storageKey }) => {
      globalThis.localStorage.setItem("api_token", nextToken);
      globalThis.localStorage.setItem(
        storageKey,
        JSON.stringify({
          status: "connected",
          mode: "mock",
          token: nextToken,
          errorMessage: null,
          connectedAt,
        }),
      );
    },
    {
      nextToken: token,
      connectedAt: new Date().toISOString(),
      storageKey: ADMIN_CONNECTION_STORAGE_KEY,
    },
  );
}

export async function openAdminConsole(page: Page, tabName?: AdminTabName) {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();

  if (!tabName) {
    return;
  }

  const tab = page.getByRole("tab", { name: tabName });
  await expect(tab).toBeVisible();
  await tab.click();
}

export async function loginAsVendorAdminAndOpenAdmin(
  page: Page,
  tabName?: AdminTabName,
) {
  await loginAsVendorAdmin(page);
  await openAdminConsole(page, tabName);
}