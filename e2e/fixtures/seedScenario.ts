import type { Page } from "@playwright/test";

export async function setSeedScenario(page: Page, scenario: "default" | "firma-a-firma-b") {
  await page.addInitScript((selectedScenario) => {
    globalThis.localStorage.setItem("xchat.seedScenario", selectedScenario);
  }, scenario);
}

export async function clearSeedScenario(page: Page) {
  await page.addInitScript(() => {
    globalThis.localStorage.removeItem("xchat.seedScenario");
  });
}
