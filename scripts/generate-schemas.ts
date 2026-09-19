import { zodToJsonSchema } from "zod-to-json-schema";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rfqMacroSchemas } from "../src/schemas/rfq/macros";
import { quotationMacroSchemas } from "../src/schemas/quotation/macros";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR =
  process.env.SCHEMAS_OUT_DIR ?? resolve(scriptDir, "../docs/api/schemas");

function writeSchema(
  kind: "rfq" | "quotation",
  transactionType: string,
  schema: object,
) {
  const jsonSchema = zodToJsonSchema(schema as never, {
    name: `${transactionType}_${kind}`,
    $refStrategy: "none",
    target: "openApi3",
  });
  const dir = resolve(OUT_DIR, kind);
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${transactionType.toLowerCase()}.v1.json`);
  writeFileSync(file, `${JSON.stringify(jsonSchema, null, 2)}\n`);
}

for (const [transactionType, schema] of Object.entries(rfqMacroSchemas)) {
  writeSchema("rfq", transactionType, schema);
}
for (const [transactionType, schema] of Object.entries(quotationMacroSchemas)) {
  writeSchema("quotation", transactionType, schema);
}

console.log("Generated JSON schemas in docs/api/schemas");
