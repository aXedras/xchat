import { test, expect } from "@playwright/test";
import { getCustomerSeed } from "../src/data/customerSeed";

const fixedIds = Array.from(
  { length: 16 },
  (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
);

test("seed factory is deterministic for the same user id", () => {
  for (const id of fixedIds) {
    expect(getCustomerSeed(id)).toEqual(getCustomerSeed(id));
  }
});

test("a seeded user id yields a complete profile", () => {
  const seeded = fixedIds
    .map((id) => getCustomerSeed(id))
    .find((seed) => seed !== null);
  expect(seeded).toBeDefined();
  expect(["onboarded", "in-review", "not-onboarded"]).toContain(
    seeded!.kycStatus,
  );
  expect(seeded!.onboardingNote.length).toBeGreaterThan(0);
  expect(seeded!.complianceFlags.length).toBeGreaterThan(0);
  expect(seeded!.timeline.length).toBeGreaterThan(0);
});

test("timeline is sorted newest first and contains both trade and chat-summary entries", () => {
  const seeded = fixedIds
    .map((id) => getCustomerSeed(id))
    .find((seed) => seed !== null);
  expect(seeded).toBeDefined();
  const timeline = seeded!.timeline;
  for (let i = 1; i < timeline.length; i++) {
    expect(Date.parse(timeline[i - 1].date)).toBeGreaterThanOrEqual(
      Date.parse(timeline[i].date),
    );
  }
  expect(timeline.some((entry) => entry.type === "trade")).toBe(true);
  expect(timeline.some((entry) => entry.type === "chat-summary")).toBe(true);
});

test("a missing or unseeded user id yields the empty state (null)", () => {
  expect(getCustomerSeed(undefined)).toBeNull();
  expect(fixedIds.some((id) => getCustomerSeed(id) === null)).toBe(true);
});
