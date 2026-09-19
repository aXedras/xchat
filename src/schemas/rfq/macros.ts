import { z } from "zod";
import {
  assayFields,
  commercialFields,
  fineness,
  logisticsFields,
  materialFields,
  tolerancePct,
} from "./common";
import { declaredComposition } from "./composition";
import { location } from "./location";
import { assayMethod, isoDate, positiveDecimalString } from "../scalars";

type Shape = z.ZodRawShape;

function rfqMacro(
  commercial: Shape = {},
  material: Shape = {},
  assay: Shape = {},
  logistics: Shape = {},
) {
  return z
    .object({
      schemaVersion: z.literal(1),
      commercial: commercialFields.extend(commercial).strict(),
      material: materialFields.extend(material).strict(),
      assay: assayFields.extend(assay).strict(),
      logistics: logisticsFields.extend(logistics).strict(),
    })
    .strict();
}

// REFINE_AND_RETURN
export const refineAndReturnRfqSchema = rfqMacro(
  {
    turnaroundTime: z.string().max(500).optional(),
    metalAccountTarget: z.string().max(200).optional(),
    returnForm: z.string().max(200).optional(),
    minimumRecovery: tolerancePct.optional(),
  },
  {
    feedstockType: z.string().max(200).optional(),
    dryWetWeight: z.string().max(500).optional(),
    moisturePct: tolerancePct.optional(),
    expectedFineMetals: declaredComposition.optional(),
    deleteriousElements: z.string().max(1000).optional(),
    batchLotInfo: z.string().max(1000).optional(),
  },
  {
    samplingSplitting: z.string().max(500).optional(),
    finalAssayAuthority: z.string().max(200).optional(),
    umpireRules: z.string().max(1000).optional(),
  },
  {
    deliveryToRefinery: z.string().max(500).optional(),
    returnLogistics: z.string().max(500).optional(),
  },
);

// SELL_DORE
export const sellDoreRfqSchema = rfqMacro(
  {
    settlementTiming: z.string().max(500).optional(),
  },
  {
    doreWeight: positiveDecimalString.optional(),
    expectedMetalContents: declaredComposition.optional(),
    originReference: z.string().max(200).optional(),
    lotReferences: z.string().max(1000).optional(),
  },
  {
    existingAssayReference: z.string().max(200).optional(),
    settlementAssayMethod: assayMethod.optional(),
  },
  {
    pickupLocation: location.optional(),
    riskTransferPoint: z.string().max(500).optional(),
  },
);

// REFINE_AND_SELL
const saleAssayBasis = z.enum(["PROVISIONAL", "FINAL"]);
const refiningFeesTreatment = z.enum(["SEPARATE", "NETTED"]);

export const refineAndSellRfqSchema = rfqMacro(
  {
    saleAssayBasis: saleAssayBasis.optional(),
    priceFixingWindow: z.string().max(500).optional(),
    refiningFeesTreatment: refiningFeesTreatment.optional(),
  },
  {
    feedstockType: z.string().max(200).optional(),
    expectedMetalContents: declaredComposition.optional(),
  },
  {
    finalAssayAuthority: z.string().max(200).optional(),
    umpireRules: z.string().max(1000).optional(),
  },
  {
    deliveryToRefinery: z.string().max(500).optional(),
    returnLogistics: z.string().max(500).optional(),
  },
);

// BUY_REFINED_METAL
const allocation = z.enum(["ALLOCATED", "UNALLOCATED"]);
const deliveryMethod = z.enum(["PHYSICAL_DELIVERY", "BOOK_TRANSFER"]);

export const buyRefinedMetalRfqSchema = rfqMacro(
  {},
  {
    brand: z.string().max(200).optional(),
    refinery: z.string().max(200).optional(),
    accreditation: z.string().max(200).optional(),
    barSize: z.string().max(100).optional(),
    pieceCount: z.number().int().positive().optional(),
    serialAvailability: z.string().max(500).optional(),
  },
  {
    certificateReference: z.string().max(200).optional(),
  },
  {
    allocation: allocation.optional(),
    deliveryMethod: deliveryMethod.optional(),
  },
);

// SELL_REFINED_METAL
const transferMethod = z.enum(["VAULT_TRANSFER", "PHYSICAL_DELIVERY"]);

export const sellRefinedMetalRfqSchema = rfqMacro(
  {},
  {
    custodyContext: z.string().max(500).optional(),
    barListReference: z.string().max(200).optional(),
    condition: z.string().max(200).optional(),
    provenanceReference: z.string().max(200).optional(),
  },
  {},
  {
    handoverLocation: location.optional(),
    transferMethod: transferMethod.optional(),
  },
);

// FABRICATE_METAL
export const fabricateMetalRfqSchema = rfqMacro(
  {
    desiredFabricationDate: isoDate.optional(),
    serviceScope: z.string().max(1000).optional(),
  },
  {
    metalAccountReference: z.string().max(200).optional(),
    availableBalance: positiveDecimalString.optional(),
    targetProducts: z.string().max(1000).optional(),
    targetPieceCount: z.number().int().positive().optional(),
    targetFineness: fineness.optional(),
    targetBrand: z.string().max(200).optional(),
    targetPackaging: z.string().max(500).optional(),
  },
  {
    accountBalanceProofReference: z.string().max(200).optional(),
  },
  {
    deliveryPreference: z.string().max(500).optional(),
    shipping: z.string().max(500).optional(),
  },
);

// BUY_FEEDSTOCK
export const buyFeedstockRfqSchema = rfqMacro(
  {
    purchaseTerms: z.string().max(2000).optional(),
  },
  {
    soughtMaterial: z.string().max(500).optional(),
    quantityBand: z.string().max(500).optional(),
    acceptedOrigin: z.string().max(500).optional(),
    assayBand: z.string().max(500).optional(),
    deliveryWindow: z.string().max(500).optional(),
  },
  {
    assayRequirements: z.string().max(1000).optional(),
  },
  {},
);

export const rfqMacroSchemas = {
  REFINE_AND_RETURN: refineAndReturnRfqSchema,
  SELL_DORE: sellDoreRfqSchema,
  REFINE_AND_SELL: refineAndSellRfqSchema,
  BUY_REFINED_METAL: buyRefinedMetalRfqSchema,
  SELL_REFINED_METAL: sellRefinedMetalRfqSchema,
  FABRICATE_METAL: fabricateMetalRfqSchema,
  BUY_FEEDSTOCK: buyFeedstockRfqSchema,
} as const;
