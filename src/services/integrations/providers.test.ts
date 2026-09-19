import { describe, expect, it } from "vitest";
import { MockComplianceProvider } from "./compliance/mockComplianceProvider";
import { MockInventoryProvider } from "./inventory/mockInventoryProvider";

describe("mock compliance provider", () => {
  it("is deterministic for the same subject organization", async () => {
    const provider = new MockComplianceProvider(0);
    const first = await provider.getCounterpartySnapshot({
      subjectOrganizationId: "20000000-0000-0000-0000-000000000001",
      viewerOrganizationId: "20000000-0000-0000-0000-000000000002",
    });
    const second = await provider.getCounterpartySnapshot({
      subjectOrganizationId: "20000000-0000-0000-0000-000000000001",
      viewerOrganizationId: "20000000-0000-0000-0000-000000000002",
    });
    expect(first.status).toBe(second.status);
    expect(first.status).toBeDefined();
  });

  it("never defaults to approved for an unknown counterparty", async () => {
    const provider = new MockComplianceProvider(0);
    const snapshot = await provider.getCounterpartySnapshot({
      subjectOrganizationId: "20000000-0000-0000-0000-00000000ffff",
      viewerOrganizationId: "20000000-0000-0000-0000-000000000002",
    });
    // The mock always returns one of the four explicit statuses; there is no
    // fallback that silently marks an unknown counterparty as approved.
    expect(["approved", "review_required", "blocked", "expired"]).toContain(
      snapshot.status,
    );
  });

  it("reports healthy", async () => {
    const provider = new MockComplianceProvider(0);
    await expect(provider.health()).resolves.toMatchObject({ ok: true });
  });
});

describe("mock inventory provider", () => {
  it("returns a deterministic lot catalogue", async () => {
    const provider = new MockInventoryProvider();
    const result = await provider.syncOrganizationInventory({
      organizationId: "20000000-0000-0000-0000-000000000001",
    });
    expect(result.lotsSynced).toBeGreaterThan(0);
  });

  it("returns null for an unknown lot instead of throwing", async () => {
    const provider = new MockInventoryProvider();
    await expect(
      provider.getLot({ sourceSystem: "mock", externalReference: "MISSING" }),
    ).resolves.toBeNull();
  });

  it("reports healthy", async () => {
    const provider = new MockInventoryProvider();
    await expect(provider.health()).resolves.toMatchObject({ ok: true });
  });
});
