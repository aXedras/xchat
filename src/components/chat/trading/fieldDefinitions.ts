import { TransactionType } from "@/schemas";

export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "decimal"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "location"
  | "composition";

export interface FieldDefinition {
  key: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
  maxLength?: number;
}

export interface LocationValue {
  countryCode: string;
  locality: string;
  postalCode?: string;
  address?: string;
}

export interface CompositionElement {
  elementCode: string;
  proportion: string;
  unit: "PCT" | "PPM";
}

const transactionTypeOptions = [
  "REFINE_AND_RETURN",
  "SELL_DORE",
  "REFINE_AND_SELL",
  "BUY_REFINED_METAL",
  "SELL_REFINED_METAL",
  "FABRICATE_METAL",
  "BUY_FEEDSTOCK",
];

export const COMMERCIAL_FIELDS: FieldDefinition[] = [
  { key: "transactionType", kind: "select", required: true, options: transactionTypeOptions },
  { key: "reference", kind: "text", maxLength: 80 },
  { key: "responseDeadline", kind: "datetime", required: true },
  { key: "settlementCurrency", kind: "text", maxLength: 3 },
  {
    key: "priceBasisPreference",
    kind: "select",
    options: ["OUTRIGHT", "BENCHMARK_PLUS_DIFFERENTIAL", "FIXING", "FORMULA", "OPEN_TO_QUOTE"],
  },
  { key: "benchmarkPreference", kind: "text", maxLength: 100 },
  { key: "paymentTermsPreference", kind: "text", maxLength: 500 },
  {
    key: "taxContext",
    kind: "select",
    options: ["EXCLUSIVE", "INCLUSIVE", "EXEMPT", "REVERSE_CHARGE", "TO_BE_DETERMINED"],
  },
  { key: "notes", kind: "textarea", maxLength: 4000 },
];

export const MATERIAL_FIELDS: FieldDefinition[] = [
  { key: "primaryMetal", kind: "select", required: true, options: ["AU", "AG", "PT", "PD", "OTHER"] },
  {
    key: "materialForm",
    kind: "select",
    required: true,
    options: ["DORE", "CONCENTRATE", "ORE", "SCRAP", "BAR", "GRAIN", "ACCOUNT_BALANCE"],
  },
  { key: "productName", kind: "text", required: true, maxLength: 200 },
  { key: "productCode", kind: "text", maxLength: 100 },
  { key: "quantity", kind: "decimal", required: true },
  { key: "quantityUnit", kind: "select", required: true, options: ["KG", "G", "TOZ", "MT", "PCS"] },
  { key: "quantityTolerancePct", kind: "decimal" },
  { key: "declaredFineness", kind: "decimal" },
  { key: "lotCount", kind: "number" },
  { key: "packaging", kind: "text", maxLength: 500 },
];

export const ASSAY_FIELDS: FieldDefinition[] = [
  { key: "assayStatus", kind: "select", required: true, options: ["NOT_AVAILABLE", "PROVISIONAL", "FINAL"] },
  { key: "assayMethod", kind: "select", options: ["FIRE_ASSAY", "XRF", "ICP", "OTHER"] },
  { key: "assayDate", kind: "date" },
  { key: "laboratoryName", kind: "text", maxLength: 200 },
  {
    key: "settlementAssayPreference",
    kind: "select",
    options: ["SELLER", "BUYER", "REFINER", "INDEPENDENT", "UMPIRE"],
  },
  { key: "samplingMethod", kind: "text", maxLength: 500 },
  { key: "umpireTerms", kind: "textarea", maxLength: 1000 },
];

export const LOGISTICS_FIELDS: FieldDefinition[] = [
  { key: "currentLocation", kind: "location", required: true },
  { key: "deliveryLocation", kind: "location" },
  { key: "availabilityFrom", kind: "datetime", required: true },
  { key: "deliveryWindowEnd", kind: "datetime" },
  { key: "incoterm", kind: "text", maxLength: 100 },
  {
    key: "transportResponsibility",
    kind: "select",
    options: ["REQUESTER", "RESPONDER", "THIRD_PARTY", "TO_BE_AGREED"],
  },
  {
    key: "insuranceResponsibility",
    kind: "select",
    options: ["REQUESTER", "RESPONDER", "THIRD_PARTY", "TO_BE_AGREED"],
  },
  { key: "securityRequirements", kind: "textarea", maxLength: 1000 },
  { key: "exportImportConstraints", kind: "textarea", maxLength: 1000 },
];

type MacroFields = Record<
  TransactionType,
  {
    commercial?: FieldDefinition[];
    material?: FieldDefinition[];
    assay?: FieldDefinition[];
    logistics?: FieldDefinition[];
  }
>;

export const MACRO_FIELDS: MacroFields = {
  REFINE_AND_RETURN: {
    commercial: [
      { key: "turnaroundTime", kind: "text", maxLength: 500 },
      { key: "metalAccountTarget", kind: "text", maxLength: 200 },
      { key: "returnForm", kind: "text", maxLength: 200 },
      { key: "minimumRecovery", kind: "decimal" },
    ],
    material: [
      { key: "feedstockType", kind: "text", maxLength: 200 },
      { key: "moisturePct", kind: "decimal" },
      { key: "deleteriousElements", kind: "textarea", maxLength: 1000 },
    ],
    assay: [
      { key: "samplingSplitting", kind: "text", maxLength: 500 },
      { key: "finalAssayAuthority", kind: "text", maxLength: 200 },
      { key: "umpireRules", kind: "textarea", maxLength: 1000 },
    ],
    logistics: [
      { key: "deliveryToRefinery", kind: "text", maxLength: 500 },
      { key: "returnLogistics", kind: "text", maxLength: 500 },
    ],
  },
  SELL_DORE: {
    commercial: [{ key: "settlementTiming", kind: "text", maxLength: 500 }],
    material: [
      { key: "doreWeight", kind: "decimal" },
      { key: "originReference", kind: "text", maxLength: 200 },
      { key: "lotReferences", kind: "text", maxLength: 1000 },
    ],
    assay: [
      { key: "existingAssayReference", kind: "text", maxLength: 200 },
      { key: "settlementAssayMethod", kind: "select", options: ["FIRE_ASSAY", "XRF", "ICP", "OTHER"] },
    ],
    logistics: [
      { key: "riskTransferPoint", kind: "text", maxLength: 500 },
    ],
  },
  REFINE_AND_SELL: {
    commercial: [
      { key: "saleAssayBasis", kind: "select", options: ["PROVISIONAL", "FINAL"] },
      { key: "priceFixingWindow", kind: "text", maxLength: 500 },
      { key: "refiningFeesTreatment", kind: "select", options: ["SEPARATE", "NETTED"] },
    ],
    material: [{ key: "feedstockType", kind: "text", maxLength: 200 }],
    assay: [
      { key: "finalAssayAuthority", kind: "text", maxLength: 200 },
      { key: "umpireRules", kind: "textarea", maxLength: 1000 },
    ],
    logistics: [
      { key: "deliveryToRefinery", kind: "text", maxLength: 500 },
      { key: "returnLogistics", kind: "text", maxLength: 500 },
    ],
  },
  BUY_REFINED_METAL: {
    material: [
      { key: "brand", kind: "text", maxLength: 200 },
      { key: "refinery", kind: "text", maxLength: 200 },
      { key: "accreditation", kind: "text", maxLength: 200 },
      { key: "barSize", kind: "text", maxLength: 100 },
      { key: "pieceCount", kind: "number" },
    ],
    assay: [{ key: "certificateReference", kind: "text", maxLength: 200 }],
    logistics: [
      { key: "allocation", kind: "select", options: ["ALLOCATED", "UNALLOCATED"] },
      { key: "deliveryMethod", kind: "select", options: ["PHYSICAL_DELIVERY", "BOOK_TRANSFER"] },
    ],
  },
  SELL_REFINED_METAL: {
    material: [
      { key: "custodyContext", kind: "text", maxLength: 500 },
      { key: "barListReference", kind: "text", maxLength: 200 },
      { key: "condition", kind: "text", maxLength: 200 },
      { key: "provenanceReference", kind: "text", maxLength: 200 },
    ],
    logistics: [
      { key: "transferMethod", kind: "select", options: ["VAULT_TRANSFER", "PHYSICAL_DELIVERY"] },
    ],
  },
  FABRICATE_METAL: {
    commercial: [
      { key: "desiredFabricationDate", kind: "date" },
      { key: "serviceScope", kind: "textarea", maxLength: 1000 },
    ],
    material: [
      { key: "metalAccountReference", kind: "text", maxLength: 200 },
      { key: "availableBalance", kind: "decimal" },
      { key: "targetProducts", kind: "text", maxLength: 1000 },
      { key: "targetPieceCount", kind: "number" },
      { key: "targetFineness", kind: "decimal" },
      { key: "targetBrand", kind: "text", maxLength: 200 },
    ],
    assay: [{ key: "accountBalanceProofReference", kind: "text", maxLength: 200 }],
    logistics: [
      { key: "deliveryPreference", kind: "text", maxLength: 500 },
      { key: "shipping", kind: "text", maxLength: 500 },
    ],
  },
  BUY_FEEDSTOCK: {
    commercial: [{ key: "purchaseTerms", kind: "textarea", maxLength: 2000 }],
    material: [
      { key: "soughtMaterial", kind: "text", maxLength: 500 },
      { key: "quantityBand", kind: "text", maxLength: 500 },
      { key: "acceptedOrigin", kind: "text", maxLength: 500 },
      { key: "assayBand", kind: "text", maxLength: 500 },
      { key: "deliveryWindow", kind: "text", maxLength: 500 },
    ],
    assay: [{ key: "assayRequirements", kind: "textarea", maxLength: 1000 }],
  },
};

export function fieldsForTab(
  transactionType: TransactionType,
  tab: "commercial" | "material" | "assay" | "logistics",
): FieldDefinition[] {
  const common =
    tab === "commercial"
      ? COMMERCIAL_FIELDS
      : tab === "material"
        ? MATERIAL_FIELDS
        : tab === "assay"
          ? ASSAY_FIELDS
          : LOGISTICS_FIELDS;
  const extra = MACRO_FIELDS[transactionType]?.[tab] ?? [];
  return [...common, ...extra];
}
