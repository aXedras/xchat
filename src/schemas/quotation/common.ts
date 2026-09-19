import { z } from "zod";
import {
  calculationMethod,
  chargeDirection,
  componentType,
  currencyCode,
  decimalString,
  isoTimestamp,
  taxTreatment,
} from "../scalars";

/**
 * A pricing component is the only way to express price, premium, discount,
 * fee, tax or credit. `numericValue`/`formulaText` are selected by the
 * calculation method (cross-field rule); OTHER requires a label and notes.
 */
export const pricingComponent = z
  .object({
    componentType,
    label: z.string().min(1).max(200),
    calculationMethod,
    numericValue: decimalString.optional(),
    formulaText: z.string().max(1000).optional(),
    currencyCode: currencyCode.optional(),
    unitCode: z.string().max(100).optional(),
    chargeDirection,
    taxTreatment: taxTreatment.optional(),
    minimumAmount: decimalString.optional(),
    maximumAmount: decimalString.optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((component, ctx) => {
    const numericMethods = [
      "FIXED_AMOUNT",
      "PER_UNIT",
      "PERCENTAGE",
      "BASIS_POINTS",
    ];
    if (
      numericMethods.includes(component.calculationMethod) &&
      component.numericValue === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "numericValue is required for this calculation method",
        path: ["numericValue"],
      });
    }
    if (
      component.calculationMethod === "FORMULA" &&
      component.formulaText === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "formulaText is required for FORMULA",
        path: ["formulaText"],
      });
    }
    if (
      component.calculationMethod === "PER_UNIT" &&
      component.unitCode === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unitCode is required for PER_UNIT",
        path: ["unitCode"],
      });
    }
    if (
      component.calculationMethod === "FIXED_AMOUNT" &&
      component.currencyCode === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "currencyCode is required for FIXED_AMOUNT",
        path: ["currencyCode"],
      });
    }
    if (
      component.componentType === "OTHER" &&
      (!component.label.trim() || !component.notes?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OTHER requires a label and notes",
        path: ["componentType"],
      });
    }
    if (
      component.minimumAmount !== undefined &&
      component.maximumAmount !== undefined &&
      Number(component.minimumAmount) > Number(component.maximumAmount)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minimumAmount must not exceed maximumAmount",
        path: ["minimumAmount"],
      });
    }
  });

export const quotationCommercialFields = z
  .object({
    validUntil: isoTimestamp,
    notes: z.string().max(4000).optional(),
  })
  .strict();

export const quotationMaterialFields = z
  .object({
    acceptedSpecification: z.string().max(1000).optional(),
    toleranceNotes: z.string().max(1000).optional(),
    deviations: z.string().max(1000).optional(),
  })
  .strict();

export const quotationAssayFields = z
  .object({
    acceptedAssayProcedure: z.string().max(500).optional(),
    payability: z.string().max(1000).optional(),
    deductions: z.string().max(1000).optional(),
    umpireTerms: z.string().max(1000).optional(),
  })
  .strict();

export const quotationLogisticsFields = z
  .object({
    route: z.string().max(1000).optional(),
    leadTime: z.string().max(500).optional(),
    responsibilityNotes: z.string().max(1000).optional(),
  })
  .strict();

export const quotationTermsRoot = z
  .object({
    schemaVersion: z.literal(1),
    commercial: quotationCommercialFields,
    material: quotationMaterialFields,
    assay: quotationAssayFields,
    logistics: quotationLogisticsFields,
    pricingComponents: z.array(pricingComponent).max(100),
  })
  .strict();

export type PricingComponent = z.infer<typeof pricingComponent>;
export type QuotationTermsV2 = z.infer<typeof quotationTermsRoot>;
