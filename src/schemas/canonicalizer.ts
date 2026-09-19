/**
 * Deterministic canonicalization for trading payloads (Phase 3, P3-027/P3-028).
 *
 * Canonicalization is pure and total: object keys are sorted recursively,
 * string values are trimmed, and empty optionals (null, empty string, empty
 * object, empty array) are removed from objects. Arrays keep their elements and
 * order.
 *
 * Decimal normalization is deliberately NOT applied blindly here (it would
 * corrupt non-decimal strings such as product codes). Decimal-typed fields are
 * normalized with `normalizeDecimalString` by the schema-aware validator before
 * canonicalization and hashing.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (isPlainObject(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const canonical = canonicalize(value[key]);
      if (!isEmpty(canonical)) {
        result[key] = canonical;
      }
    }
    return result;
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function normalizeDecimalString(value: string): string {
  let normalized = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return normalized;
  }

  const negative = normalized.startsWith("-");
  if (negative) {
    normalized = normalized.slice(1);
  }

  const [integerPart, fractionPart] = normalized.split(".");
  let integer = integerPart.replace(/^0+(?=\d)/, "");
  if (integer.length === 0) {
    integer = "0";
  }

  const fraction = (fractionPart ?? "").replace(/0+$/, "");

  const canonical = fraction.length > 0 ? `${integer}.${fraction}` : integer;
  return negative && canonical !== "0" ? `-${canonical}` : canonical;
}

export async function hashCanonical(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
