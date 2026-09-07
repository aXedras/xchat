import { test, expect, type Page } from "@playwright/test";

test.setTimeout(120000);

const alice = {
  email: "alice@xchat.test.local",
  password: "Al1ce-Test-Pw",
  name: "Alice Metal",
};
const bob = {
  email: "bob@xchat.test.local",
  password: "B0b-Test-Pw",
  name: "Bob Trader",
};
const carol = {
  email: "carol@xchat.test.local",
  password: "Car0l-Test-Pw",
  name: "Carol Ops",
};

async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.goto("/");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function sendNewMessage(
  page: Page,
  participantName: string,
  content: string,
) {
  await page.getByRole("button", { name: "Start New Conversation" }).click();
  await page.getByRole("button", { name: new RegExp(participantName) }).click();
  await page.getByPlaceholder("Write your first message...").fill(content);
  await page.getByRole("button", { name: /^Send/ }).click();
  // A single known-good recipient always dispatches as "completed", which
  // auto-closes the dialog. Wait for that before any follow-up call reopens
  // it, otherwise it can reopen showing the previous send's stale result panel.
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("direct message is delivered to the recipient and hidden from third parties", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const carolContext = await browser.newContext();

  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  const carolPage = await carolContext.newPage();

  const marker = `direct-${Date.now()}`;

  await loginAs(alicePage, alice);
  await loginAs(bobPage, bob);
  await loginAs(carolPage, carol);

  await sendNewMessage(alicePage, bob.name, marker);

  await expect(
    bobPage.getByText(alice.name, { exact: true }).first(),
  ).toBeVisible({ timeout: 30000 });
  await bobPage.getByText(alice.name, { exact: true }).first().click();
  await expect(bobPage.getByText(marker).first()).toBeVisible({
    timeout: 30000,
  });

  await expect(carolPage.getByText(marker)).toHaveCount(0);

  await aliceContext.close();
  await bobContext.close();
  await carolContext.close();
});

test("fan-out sends separate bilateral messages to multiple recipients", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const carolContext = await browser.newContext();

  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  const carolPage = await carolContext.newPage();

  const marker = `fanout-${Date.now()}`;

  await loginAs(alicePage, alice);
  await loginAs(bobPage, bob);
  await loginAs(carolPage, carol);

  await alicePage
    .getByRole("button", { name: "Start New Conversation" })
    .click();
  await alicePage.getByRole("button", { name: new RegExp(bob.name) }).click();
  await alicePage.getByRole("button", { name: new RegExp(carol.name) }).click();
  await alicePage.getByPlaceholder("Write your first message...").fill(marker);
  await alicePage
    .getByRole("button", { name: /^Send to 2 recipients/ })
    .click();

  await expect(
    bobPage.getByText(alice.name, { exact: true }).first(),
  ).toBeVisible({ timeout: 30000 });
  await bobPage.getByText(alice.name, { exact: true }).first().click();
  await expect(bobPage.getByText(marker).first()).toBeVisible({
    timeout: 30000,
  });

  await expect(
    carolPage.getByText(alice.name, { exact: true }).first(),
  ).toBeVisible({ timeout: 30000 });
  await carolPage.getByText(alice.name, { exact: true }).first().click();
  await expect(carolPage.getByText(marker).first()).toBeVisible({
    timeout: 30000,
  });

  await aliceContext.close();
  await bobContext.close();
  await carolContext.close();
});

test("rfq: recipient submits a quote and owner books it", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();

  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  await loginAs(alicePage, alice);
  await loginAs(bobPage, bob);

  await alicePage
    .getByRole("button", { name: "Start New Conversation" })
    .click();
  await alicePage.getByRole("button", { name: new RegExp(bob.name) }).click();
  await alicePage.getByRole("button", { name: "RFQ", exact: true }).click();
  await alicePage.getByLabel("Quantity", { exact: true }).fill("6x1KG");
  await alicePage.getByLabel("Product", { exact: true }).fill("Gold");
  await alicePage.getByLabel("Product code", { exact: true }).fill("XAU");
  await alicePage.getByLabel("Quality", { exact: true }).fill("LBMA");
  await alicePage.getByLabel("Location", { exact: true }).fill("Zurich");
  await alicePage.getByLabel("Price basis", { exact: true }).fill("ZRH fixing");
  await alicePage.getByLabel("Premium", { exact: true }).fill("+0.25");
  await alicePage.getByRole("button", { name: "Send RFQ" }).click();

  await expect(
    bobPage.getByText(alice.name, { exact: true }).first(),
  ).toBeVisible({ timeout: 30000 });
  await bobPage.getByText(alice.name, { exact: true }).first().click();
  await bobPage.getByPlaceholder("Premium (e.g. +0.20)").first().fill("+0.20");
  await bobPage.getByRole("button", { name: "Submit Quote" }).first().click();

  await alicePage.getByText(bob.name, { exact: true }).first().click();
  await expect(alicePage.getByText("+0.20").first()).toBeVisible({
    timeout: 30000,
  });
  await alicePage.getByRole("button", { name: "Book Deal" }).click();
  // Scoped with .first(): repeated runs against the same shared local test
  // accounts accumulate earlier "converted" RFQ cards for this same
  // alice/bob pair, so this is not a strict single-match assertion.
  await expect(alicePage.getByText(/converted/i).first()).toBeVisible({
    timeout: 30000,
  });

  await aliceContext.close();
  await bobContext.close();
});

test("ambiguous send failure reuses the same dispatch id and delivers once", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();

  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  const marker = `ambiguous-${Date.now()}`;
  const dispatchIds: string[] = [];
  let attempts = 0;

  await loginAs(alicePage, alice);
  await loginAs(bobPage, bob);

  await alicePage.route("**/rpc/send_messages", async (route) => {
    attempts += 1;
    const body = route.request().postDataJSON() as {
      request?: { dispatchId?: string };
    };
    if (body?.request?.dispatchId) {
      dispatchIds.push(body.request.dispatchId);
    }
    if (attempts === 1) {
      await route.abort("connectionfailed");
    } else {
      await route.continue();
    }
  });

  await alicePage
    .getByRole("button", { name: "Start New Conversation" })
    .click();
  await alicePage.getByRole("button", { name: new RegExp(bob.name) }).click();
  await alicePage.getByPlaceholder("Write your first message...").fill(marker);
  await alicePage
    .getByRole("button", { name: /^Send to 1 recipient$/ })
    .click();

  await expect(alicePage.getByText(/Sending failed/)).toBeVisible();

  await alicePage
    .getByRole("button", { name: /^Send to 1 recipient$/ })
    .click();

  await expect(
    bobPage.getByText(alice.name, { exact: true }).first(),
  ).toBeVisible({ timeout: 30000 });
  await bobPage.getByText(alice.name, { exact: true }).first().click();
  await expect(bobPage.getByText(marker).first()).toBeVisible({
    timeout: 30000,
  });

  expect(dispatchIds).toHaveLength(2);
  expect(dispatchIds[0]).toBe(dispatchIds[1]);

  await aliceContext.close();
  await bobContext.close();
});

test("reply draft survives a failed send and can be resent", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();

  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  const setupMarker = `setup-${Date.now()}`;
  const successMarker = `success-${Date.now()}`;
  const draftMarker = `draft-${Date.now()}`;

  await loginAs(alicePage, alice);
  await loginAs(bobPage, bob);

  await sendNewMessage(alicePage, bob.name, setupMarker);
  await alicePage.getByText(bob.name, { exact: true }).first().click();

  const input = alicePage.getByPlaceholder("Type a message...");
  await expect(input).toBeVisible();

  // A successful send clears the draft (Send button).
  await input.fill(successMarker);
  await alicePage.getByRole("button", { name: "Send message" }).click();
  await expect(input).toHaveValue("");

  // A failed send keeps the draft (Enter key) and surfaces the error banner.
  let failNext = true;
  await alicePage.route("**/rpc/send_messages", async (route) => {
    if (failNext) {
      failNext = false;
      await route.abort("connectionfailed");
    } else {
      await route.continue();
    }
  });

  await input.fill(draftMarker);
  await input.press("Enter");
  await expect(input).toHaveValue(draftMarker);
  await expect(alicePage.getByText("unknown", { exact: true })).toBeVisible();

  // Resending the same draft succeeds and clears the input.
  await alicePage.getByRole("button", { name: "Send message" }).click();
  await expect(input).toHaveValue("");

  await expect(bobPage.getByText(draftMarker).first()).toBeVisible({
    timeout: 30000,
  });

  await aliceContext.close();
  await bobContext.close();
});
