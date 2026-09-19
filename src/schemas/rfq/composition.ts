import { z } from "zod";
import { decimalString } from "../scalars";

/**
 * Declared composition element: element code plus proportion and unit.
 * When all elements use PCT the proportions represent a declared composition
 * and must not exceed 100 (cross-field rule; see docs/trading/schema-rules.md).
 */
export const compositionUnit = z.enum(["PCT", "PPM"]);

export const compositionElement = z
  .object({
    elementCode: z.string().min(1).max(20),
    proportion: decimalString,
    unit: compositionUnit,
  })
  .strict();

export const declaredComposition = z.array(compositionElement).max(100);

export type CompositionElement = z.infer<typeof compositionElement>;
