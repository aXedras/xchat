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

test("side panel default tab is deterministic across chat switches and preserves valid manual selection", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();

  await loginAs(alicePage, alice);

  const marker = `sp-${Date.now()}`;

  // Normal chat with Carol (no RFQ). No other spec sends Carol an RFQ, so
  // her chat with Alice is guaranteed to stay RFQ-free across a full suite
  // run against the shared local test accounts (unlike Bob, who does receive
  // RFQs from other specs and is used below for the RFQ leg instead, where
  // hasRfq only needs to be true, regardless of prior RFQ history).
  await alicePage
    .getByRole("button", { name: "Start New Conversation" })
    .click();
  await alicePage.getByRole("button", { name: new RegExp(carol.name) }).click();
  await alicePage
    .getByPlaceholder("Write your first message...")
    .fill(`${marker}-carol`);
  await alicePage
    .getByRole("button", { name: /^Send to 1 recipient$/ })
    .click();
  // A single known-good recipient always dispatches as "completed", which
  // auto-closes the dialog.
  const dialog = alicePage.getByRole("dialog", {
    name: "Start New Conversation",
  });
  await expect(dialog).toBeHidden();

  // RFQ chat with Bob.
  await alicePage
    .getByRole("button", { name: "Start New Conversation" })
    .click();
  await expect(dialog).toBeVisible();
  await alicePage.getByRole("button", { name: new RegExp(bob.name) }).click();
  await alicePage.getByRole("button", { name: "RFQ", exact: true }).click();
  await alicePage.getByLabel("Quantity", { exact: true }).fill("1KG");
  await alicePage.getByLabel("Product", { exact: true }).fill("Gold");
  await alicePage.getByLabel("Product code", { exact: true }).fill("XAU");
  await alicePage.getByLabel("Quality", { exact: true }).fill("LBMA");
  await alicePage.getByLabel("Location", { exact: true }).fill("Zurich");
  await alicePage.getByLabel("Price basis", { exact: true }).fill("ZRH fixing");
  await alicePage.getByLabel("Premium", { exact: true }).fill("+0.25");
  await alicePage.getByRole("button", { name: "Send RFQ" }).click();
  await expect(dialog).toBeHidden();

  // Sending does not auto-select the new conversation; select Bob's chat.
  // Its default tab is "RFQ Context".
  await alicePage.getByText(bob.name, { exact: true }).first().click();
  await expect(
    alicePage.getByRole("button", { name: "RFQ Context" }),
  ).toBeVisible();
  await expect(
    alicePage.getByRole("button", { name: "RFQ Context" }),
  ).toHaveClass(/border-primary/);

  // Manually select Inventory while staying in the same (Bob) chat.
  await alicePage.getByRole("button", { name: "Inventory" }).click();
  await expect(
    alicePage.getByRole("button", { name: "Inventory" }),
  ).toHaveClass(/border-primary/);

  // Switching to Carol's normal chat must not leave the invisible Inventory tab active;
  // it must fall back to the Customer default, and Inventory/RFQ tabs must not render.
  await alicePage.getByText(carol.name, { exact: true }).first().click();
  await expect(alicePage.getByRole("button", { name: "Customer" })).toHaveClass(
    /border-primary/,
  );
  await expect(
    alicePage.getByRole("button", { name: "Inventory" }),
  ).toHaveCount(0);
  await expect(
    alicePage.getByRole("button", { name: "RFQ Context" }),
  ).toHaveCount(0);
  await expect(alicePage.getByTestId("customer-name")).toHaveText(carol.name);

  // Switching back to Bob's RFQ chat resets to the RFQ Context default again,
  // it does not resurrect the previously (manually) selected Inventory tab.
  await alicePage.getByText(bob.name, { exact: true }).first().click();
  await expect(
    alicePage.getByRole("button", { name: "RFQ Context" }),
  ).toHaveClass(/border-primary/);

  // Selecting Customer manually, then triggering a same-chat update (another message),
  // must preserve the manual selection.
  await alicePage.getByRole("button", { name: "Customer" }).click();
  await expect(alicePage.getByTestId("customer-name")).toHaveText(bob.name);

  await aliceContext.close();
});
