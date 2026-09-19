import { z } from "zod";

/**
 * Shared scalar and enum schemas for the trading domain (Phase 3).
 * Decimal and monetary values are always transmitted as decimal strings to
 * preserve precision; never as JavaScript numbers (floats).
 */

export const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "must be a decimal string");

export const positiveDecimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "must be a positive decimal string");

export const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "must be an ISO-4217 currency code");

export const countryCode = z
  .string()
  .regex(/^[A-Z]{2}$/, "must be an ISO-3166-1 alpha-2 country code");

export const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "must be a UUID",
  );

export const isoDate = z.string().date("must be an ISO-8601 date");

export const isoTimestamp = z
  .string()
  .datetime({ offset: true, message: "must be an ISO-8601 timestamp" });

export const quantityUnit = z.enum(["KG", "G", "TOZ", "MT", "PCS"]);

export const primaryMetal = z.enum(["AU", "AG", "PT", "PD", "OTHER"]);

export const materialForm = z.enum([
  "DORE",
  "CONCENTRATE",
  "ORE",
  "SCRAP",
  "BAR",
  "GRAIN",
  "ACCOUNT_BALANCE",
]);

export const transactionType = z.enum([
  "REFINE_AND_RETURN",
  "SELL_DORE",
  "REFINE_AND_SELL",
  "BUY_REFINED_METAL",
  "SELL_REFINED_METAL",
  "FABRICATE_METAL",
  "BUY_FEEDSTOCK",
]);

export const priceBasisPreference = z.enum([
  "OUTRIGHT",
  "BENCHMARK_PLUS_DIFFERENTIAL",
  "FIXING",
  "FORMULA",
  "OPEN_TO_QUOTE",
]);

export const taxContext = z.enum([
  "EXCLUSIVE",
  "INCLUSIVE",
  "EXEMPT",
  "REVERSE_CHARGE",
  "TO_BE_DETERMINED",
]);

export const assayStatus = z.enum(["NOT_AVAILABLE", "PROVISIONAL", "FINAL"]);

export const assayMethod = z.enum(["FIRE_ASSAY", "XRF", "ICP", "OTHER"]);

export const settlementAssayPreference = z.enum([
  "SELLER",
  "BUYER",
  "REFINER",
  "INDEPENDENT",
  "UMPIRE",
]);

export const responsibility = z.enum([
  "REQUESTER",
  "RESPONDER",
  "THIRD_PARTY",
  "TO_BE_AGREED",
]);

export const componentType = z.enum([
  "METAL_PRICE",
  "PREMIUM",
  "DISCOUNT",
  "REFINING_CHARGE",
  "TREATMENT_CHARGE",
  "ASSAY_FEE",
  "FABRICATION_FEE",
  "LOGISTICS_FEE",
  "INSURANCE_FEE",
  "MINIMUM_CHARGE",
  "TAX",
  "BYPRODUCT_CREDIT",
  "OTHER",
]);

export const calculationMethod = z.enum([
  "FIXED_AMOUNT",
  "PER_UNIT",
  "PERCENTAGE",
  "BASIS_POINTS",
  "FORMULA",
  "INCLUDED",
]);

export const chargeDirection = z.enum([
  "PAYABLE_BY_REQUESTER",
  "PAYABLE_BY_RESPONDER",
  "CREDIT_TO_REQUESTER",
  "CREDIT_TO_RESPONDER",
]);

export const taxTreatment = z.enum([
  "EXCLUSIVE",
  "INCLUSIVE",
  "EXEMPT",
  "REVERSE_CHARGE",
  "TO_BE_DETERMINED",
]);

export type DecimalString = z.infer<typeof decimalString>;
export type QuantityUnit = z.infer<typeof quantityUnit>;
export type PrimaryMetal = z.infer<typeof primaryMetal>;
export type MaterialForm = z.infer<typeof materialForm>;
export type TransactionType = z.infer<typeof transactionType>;
