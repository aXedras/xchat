import { ProviderHealth } from "../compliance/types";
import {
  ExternalInventoryLot,
  InventoryLotLookup,
  InventoryProvider,
  InventorySyncInput,
  InventorySyncResult,
} from "./types";

const FIXTURES: ExternalInventoryLot[] = [
  {
    sourceSystem: "mock",
    externalReference: "LOT-AU-001",
    primaryMetal: "AU",
    materialForm: "BAR",
    quantity: "12.50000000",
    quantityUnit: "KG",
    fineness: "0.9999",
    location: { countryCode: "CH", locality: "Zurich" },
    availabilityStatus: "available",
    sourceObservedAt: "2026-09-01T00:00:00Z",
  },
  {
    sourceSystem: "mock",
    externalReference: "LOT-AG-002",
    primaryMetal: "AG",
    materialForm: "GRAIN",
    quantity: "500.00000000",
    quantityUnit: "KG",
    fineness: "0.9990",
    location: { countryCode: "CH", locality: "Zurich" },
    availabilityStatus: "available",
    sourceObservedAt: "2026-09-01T00:00:00Z",
  },
];

/**
 * Deterministic mock inventory provider with a small fixed lot catalogue.
 */
export class MockInventoryProvider implements InventoryProvider {
  async syncOrganizationInventory(
    input: InventorySyncInput,
  ): Promise<InventorySyncResult> {
    return {
      organizationId: input.organizationId,
      provider: "mock",
      lotsSynced: FIXTURES.length,
      lotsRemoved: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  async getLot(input: InventoryLotLookup): Promise<ExternalInventoryLot | null> {
    return (
      FIXTURES.find(
        (lot) =>
          lot.sourceSystem === input.sourceSystem &&
          lot.externalReference === input.externalReference,
      ) ?? null
    );
  }

  async health(): Promise<ProviderHealth> {
    return { ok: true, provider: "mock-inventory", latencyMs: 3 };
  }
}
