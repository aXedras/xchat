import { z } from "zod";
import {
  quotationAssayFields,
  quotationCommercialFields,
  quotationLogisticsFields,
  quotationMaterialFields,
  quotationTermsRoot,
} from "./common";

type Shape = z.ZodRawShape;

function quotationMacro(
  commercial: Shape = {},
  material: Shape = {},
  assay: Shape = {},
  logistics: Shape = {},
) {
  return z
    .object({
      schemaVersion: z.literal(1),
      commercial: quotationCommercialFields.extend(commercial).strict(),
      material: quotationMaterialFields.extend(material).strict(),
      assay: quotationAssayFields.extend(assay).strict(),
      logistics: quotationLogisticsFields.extend(logistics).strict(),
      pricingComponents: quotationTermsRoot.shape.pricingComponents,
    })
    .strict();
}

// REFINE_AND_RETURN
export const refineAndReturnQuotationSchema = quotationMacro(
  {},
  {},
  {
    metalRetentionTerms: z.string().max(1000).optional(),
  },
  {
    turnaroundCommitment: z.string().max(500).optional(),
  },
);

// SELL_DORE
export const sellDoreQuotationSchema = quotationMacro(
  {
    settlementTiming: z.string().max(500).optional(),
  },
  {},
  {
    penalties: z.string().max(1000).optional(),
  },
  {},
);

// REFINE_AND_SELL
const saleAssayBasis = z.enum(["PROVISIONAL", "FINAL"]);
const refiningFeesTreatment = z.enum(["SEPARATE", "NETTED"]);

export const refineAndSellQuotationSchema = quotationMacro(
  {
    saleAssayBasis: saleAssayBasis.optional(),
    refiningFeesTreatment: refiningFeesTreatment.optional(),
  },
  {},
  {
    metalRetentionTerms: z.string().max(1000).optional(),
  },
  {
    turnaroundCommitment: z.string().max(500).optional(),
  },
);

// BUY_REFINED_METAL
export const buyRefinedMetalQuotationSchema = quotationMacro(
  {},
  {
    brand: z.string().max(200).optional(),
    productSpecification: z.string().max(1000).optional(),
    availableQuantity: z.string().max(500).optional(),
  },
  {},
  {},
);

// SELL_REFINED_METAL
export const sellRefinedMetalQuotationSchema = quotationMacro(
  {},
  {
    acceptanceCriteria: z.string().max(1000).optional(),
    inspectionRequirement: z.string().max(1000).optional(),
  },
  {},
  {},
);

// FABRICATE_METAL
export const fabricateMetalQuotationSchema = quotationMacro(
  {},
  {},
  {},
  {
    leadTime: z.string().max(500).optional(),
    metalLossTolerance: z.string().max(500).optional(),
  },
);

// BUY_FEEDSTOCK
export const buyFeedstockQuotationSchema = quotationMacro(
  {},
  {
    availableMaterial: z.string().max(1000).optional(),
    assayDetails: z.string().max(1000).optional(),
  },
  {},
  {},
);

export const quotationMacroSchemas = {
  REFINE_AND_RETURN: refineAndReturnQuotationSchema,
  SELL_DORE: sellDoreQuotationSchema,
  REFINE_AND_SELL: refineAndSellQuotationSchema,
  BUY_REFINED_METAL: buyRefinedMetalQuotationSchema,
  SELL_REFINED_METAL: sellRefinedMetalQuotationSchema,
  FABRICATE_METAL: fabricateMetalQuotationSchema,
  BUY_FEEDSTOCK: buyFeedstockQuotationSchema,
} as const;
