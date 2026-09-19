import { z } from "zod";
import {
  assayMethod,
  assayStatus,
  countryCode,
  currencyCode,
  decimalString,
  isoDate,
  isoTimestamp,
  materialForm,
  positiveDecimalString,
  priceBasisPreference,
  primaryMetal,
  quantityUnit,
  responsibility,
  settlementAssayPreference,
  taxContext,
  transactionType,
  uuid,
} from "../scalars";
import { declaredComposition } from "./composition";
import { location } from "./location";

const quantity = positiveDecimalString.refine(
  (value) => !/^0+(\.0+)?$/.test(value),
  { message: "must be greater than zero" },
);

export const fineness = decimalString.refine(
  (value) => {
    const numeric = Number(value);
    return numeric >= 0 && numeric <= 1;
  },
  { message: "must be between 0 and 1" },
);

export const tolerancePct = decimalString.refine(
  (value) => {
    const numeric = Number(value);
    return numeric >= 0 && numeric <= 100;
  },
  { message: "must be between 0 and 100" },
);

const uuidList = z.array(uuid).max(100);

export const commercialFields = z
  .object({
    transactionType,
    reference: z.string().min(1).max(80).optional(),
    responseDeadline: isoTimestamp,
    settlementCurrency: currencyCode.optional(),
    priceBasisPreference: priceBasisPreference.optional(),
    benchmarkPreference: z.string().max(100).optional(),
    paymentTermsPreference: z.string().max(500).optional(),
    taxContext: taxContext.optional(),
    partialFulfilmentAllowed: z.boolean(),
    notes: z.string().max(4000).optional(),
  })
  .strict();

export const materialFields = z
  .object({
    primaryMetal,
    materialForm,
    productName: z.string().min(1).max(200),
    productCode: z.string().max(100).optional(),
    quantity,
    quantityUnit,
    quantityTolerancePct: tolerancePct.optional(),
    declaredFineness: fineness.optional(),
    lotCount: z.number().int().positive().optional(),
    packaging: z.string().max(500).optional(),
    inventoryReferences: uuidList.optional(),
  })
  .strict();

export const assayFields = z
  .object({
    assayStatus,
    assayMethod: assayMethod.optional(),
    assayDate: isoDate.optional(),
    laboratoryName: z.string().max(200).optional(),
    declaredComposition: declaredComposition.optional(),
    settlementAssayPreference: settlementAssayPreference.optional(),
    samplingMethod: z.string().max(500).optional(),
    umpireTerms: z.string().max(1000).optional(),
    assayDocumentIds: uuidList.optional(),
  })
  .strict();

export const logisticsFields = z
  .object({
    currentLocation: location,
    deliveryLocation: location.optional(),
    availabilityFrom: isoTimestamp,
    deliveryWindowEnd: isoTimestamp.optional(),
    incoterm: z.string().max(100).optional(),
    transportResponsibility: responsibility.optional(),
    insuranceResponsibility: responsibility.optional(),
    securityRequirements: z.string().max(1000).optional(),
    exportImportConstraints: z.string().max(1000).optional(),
    logisticsDocumentIds: uuidList.optional(),
  })
  .strict();

export const rfqTermsRoot = z
  .object({
    schemaVersion: z.literal(1),
    commercial: commercialFields,
    material: materialFields,
    assay: assayFields,
    logistics: logisticsFields,
  })
  .strict();

export type RfqTermsV2 = z.infer<typeof rfqTermsRoot>;
export type CommercialFields = z.infer<typeof commercialFields>;
export type MaterialFields = z.infer<typeof materialFields>;
export type AssayFields = z.infer<typeof assayFields>;
export type LogisticsFields = z.infer<typeof logisticsFields>;

export { countryCode };
