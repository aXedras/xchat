import { ProviderHealth } from "../compliance/types";

export type AvailabilityStatus = "available" | "reserved" | "unavailable" | "unknown";

export interface ExternalInventoryLot {
  sourceSystem: string;
  externalReference: string;
  primaryMetal: string;
  materialForm: string;
  quantity: string;
  quantityUnit: string;
  fineness: string | null;
  location: Record<string, unknown>;
  availabilityStatus: AvailabilityStatus;
  sourceObservedAt: string;
}

export interface InventorySyncInput {
  organizationId: string;
}

export interface InventorySyncResult {
  organizationId: string;
  provider: string;
  lotsSynced: number;
  lotsRemoved: number;
  startedAt: string;
  finishedAt: string;
}

export interface InventoryLotLookup {
  sourceSystem: string;
  externalReference: string;
}

/**
 * Inventory port (bauplan section 12.1). The mock and any future BIL adapter
 * implement the identical contract.
 */
export interface InventoryProvider {
  syncOrganizationInventory(input: InventorySyncInput): Promise<InventorySyncResult>;
  getLot(input: InventoryLotLookup): Promise<ExternalInventoryLot | null>;
  health(): Promise<ProviderHealth>;
}
