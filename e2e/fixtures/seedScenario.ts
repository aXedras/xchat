import type { Page } from "@playwright/test";

export async function setSeedScenario(page: Page, scenario: "default" | "firma-a-firma-b") {
  await page.goto("/");
  await page.evaluate((selectedScenario) => {
    globalThis.localStorage.setItem("xchat.seedScenario", selectedScenario);
  }, scenario);
}

export async function clearSeedScenario(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    globalThis.localStorage.removeItem("xchat.seedScenario");
  });
}
