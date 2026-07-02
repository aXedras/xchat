export interface InventoryPosition {
  id: string;
  product: string;
  productCode: string;
  quantity: number;
  unit: string;
  location: string;
  status: "available" | "reserved" | "in-transit" | "blocked";
}

export interface InventoryFlow {
  id: string;
  type: "inflow" | "outflow";
  source: "purchase" | "sale" | "production" | "reservation" | "transfer";
  product: string;
  productCode: string;
  quantity: number;
  unit: string;
  location: string;
  expectedDate: string;
  counterparty?: string;
  status: "planned" | "confirmed" | "in-transit" | "completed";
  isHistorical: boolean;
}
