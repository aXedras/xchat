# Schema Rules — Cross-Field and Cross-Layer Validation (Phase 3)

Status: accepted
Date: 2026-09-18

The strict JSON/Zod schemas in `src/schemas/` (and the generated JSON Schemas in
`docs/api/schemas/`) express the structural shape: required fields, types,
enums, lengths and `additionalProperties: false`. The rules below cannot be
reliably expressed by JSON Schema alone and are enforced in Zod (TS) and mirrored
in the SQL validator (Phase 4) from the same field IDs.

## Field IDs

The JSON object keys of the payloads are the shared field IDs. TypeScript (Zod)
and PostgreSQL (SQL validator) both consume these keys, so both layers validate
against the same vocabulary. Decimal and monetary values are always decimal
strings; units and currencies are explicit; timestamps are ISO-8601 in UTC.

## Cross-field rules

### Commercial

- `settlementCurrency` is required whenever money-denominated price components
  are expected (request) or present (quotation). It is optional otherwise.
- `partialFulfilmentAllowed` must be `false` in Release 1; the server rejects
  `true` with a validation error.
- `responseDeadline` must be in the future relative to server time and within a
  maximum allowed horizon. The client shows local time; the server is
  authoritative.

### Material

- `quantity` must be greater than zero.
- `declaredFineness` is required when the material is a refined product; it is
  optional for unrefined feedstock. It must be within `0..1`.
- `quantityTolerancePct` must be within `0..100`.

### Assay

- `assayMethod` is required when `assayStatus` is `PROVISIONAL` or `FINAL`.
- `settlementAssayPreference` is required when the transaction settles on assay.
- `declaredComposition` proportions, when all expressed in `PCT`, must not exceed
  100 in total.

### Logistics

- `deliveryLocation` is required for transactions that imply delivery; optional
  for pure book transfers.
- `deliveryWindowEnd`, when present, must be `>= availabilityFrom`.

### Pricing components

- For `FIXED_AMOUNT`, `PER_UNIT`, `PERCENTAGE`, `BASIS_POINTS` the component
  carries `numericValue`.
- For `FORMULA` it carries `formulaText` (rendered as formula, never as a
  computed live price).
- For `INCLUDED` neither value is required.
- `PER_UNIT` requires `unitCode`; `FIXED_AMOUNT` requires `currencyCode`.
- `minimumAmount <= maximumAmount` when both are present.
- `componentType = OTHER` requires a non-empty `label` and `notes`.

## SQL validator contract (P3-029)

Phase 4 implements `normalize_rfq_terms_v2` and `normalize_quote_response_v2` as
`SECURITY DEFINER` functions that mirror the Zod validation from the same field
IDs. Contract tests will run the same valid/invalid fixtures against both layers
and require identical accept/reject outcomes.

The SQL validator additionally:

- checks `response_deadline` against `now()` and the maximum horizon;
- canonicalizes the payload (trim, decimal normalization, key ordering, empty
  optional removal) and stores the canonical form plus its hash;
- rejects unknown root keys and unknown tab keys fail-closed;
- never trusts client-provided `schema_version` beyond the allowlist.
