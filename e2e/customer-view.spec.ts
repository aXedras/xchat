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
  const dialog = page.getByRole("dialog", { name: "Start New Conversation" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: new RegExp(participantName) }).click();
  await page.getByPlaceholder("Write your first message...").fill(content);
  await page.getByRole("button", { name: /^Send/ }).click();
  await expect(dialog).toBeHidden();
}

async function openCustomerTab(page: Page) {
  // The RFQ Context tab can be the default active tab for a chat that
  // already has an RFQ (e.g. from an earlier test run against the same
  // shared local test accounts); the Customer tab is always visible, so
  // select it explicitly rather than assuming it is already active.
  await page.getByRole("button", { name: "Customer" }).click();
}

test("customer view is visible and scoped to the selected counterparty", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();

  await loginAs(alicePage, alice);

  const marker = `cv-${Date.now()}`;
  await sendNewMessage(alicePage, bob.name, marker);
  await sendNewMessage(alicePage, carol.name, marker);

  await alicePage.getByText(bob.name, { exact: true }).first().click();
  await expect(
    alicePage.getByRole("button", { name: "Customer" }),
  ).toBeVisible();
  await openCustomerTab(alicePage);
  await expect(alicePage.getByTestId("customer-name")).toHaveText(bob.name);

  await alicePage.getByText(carol.name, { exact: true }).first().click();
  await openCustomerTab(alicePage);
  await expect(alicePage.getByTestId("customer-name")).toHaveText(carol.name);

  await aliceContext.close();
});

test("customer view renders either a full seeded profile or the defined empty state, never a mix", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();

  await loginAs(alicePage, alice);

  const marker = `cv-full-${Date.now()}`;
  await sendNewMessage(alicePage, bob.name, marker);
  await alicePage.getByText(bob.name, { exact: true }).first().click();
  await openCustomerTab(alicePage);
  await expect(alicePage.getByTestId("customer-name")).toBeVisible();

  const kycBadge = alicePage.locator(
    "text=/KYC onboarded|KYC in review|Not onboarded/",
  );
  const emptyStateText = alicePage.getByText(
    "Für diese Gegenpartei liegen noch keine Kundendaten vor.",
    { exact: false },
  );

  if ((await kycBadge.count()) > 0) {
    await expect(kycBadge.first()).toBeVisible();
    await expect(alicePage.getByText("Transaction history")).toBeVisible();
    await expect(emptyStateText).toHaveCount(0);
  } else {
    await expect(emptyStateText.first()).toBeVisible();
    await expect(
      alicePage.getByText("No transactions recorded yet."),
    ).toBeVisible();
  }

  await aliceContext.close();
});
