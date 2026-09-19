import { z } from "zod";
import { rfqMacroSchemas } from "./rfq/macros";
import { quotationMacroSchemas } from "./quotation/macros";

export type DocumentKind = "rfq" | "quotation";

export const CURRENT_SCHEMA_VERSION = 1;

export class SchemaRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaRegistryError";
  }
}

/**
 * Resolves the strict schema for a (transactionType, documentKind, schemaVersion)
 * triple. Unknown transaction types and unknown schema versions fail closed.
 *
 * Version 0 denotes legacy payloads (pre-structured `rawTerms` / `quoted_premium`);
 * it is intentionally not resolvable here — legacy data is read-only and handled
 * at the repository/database boundary (see Phase 7), never written through the V2
 * schemas.
 */
export function getTradingSchema(
  transactionType: string,
  documentKind: DocumentKind,
  schemaVersion: number,
): z.ZodType {
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new SchemaRegistryError(
      `unsupported schema version ${schemaVersion} for ${documentKind}`,
    );
  }

  const schemas =
    documentKind === "rfq" ? rfqMacroSchemas : quotationMacroSchemas;
  const schema = schemas[transactionType as keyof typeof schemas];

  if (!schema) {
    throw new SchemaRegistryError(
      `unknown transaction type ${transactionType} for ${documentKind}`,
    );
  }

  return schema;
}

export const TRANSACTION_TYPES = Object.keys(
  rfqMacroSchemas,
) as Array<keyof typeof rfqMacroSchemas>;
