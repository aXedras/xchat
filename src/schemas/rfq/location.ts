import { z } from "zod";
import { countryCode } from "../scalars";

/**
 * A physical location. Country and locality are required; the exact street
 * address is optional and must be treated as protected data (only surfaced to
 * entitled viewers, never stored redundantly in chat content).
 */
export const location = z
  .object({
    countryCode,
    locality: z.string().min(1).max(200),
    postalCode: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
  })
  .strict();

export type Location = z.infer<typeof location>;
