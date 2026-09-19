/**
 * Pure, deterministic unit conversion for trade volume (Phase 11).
 * Quantities are decimal strings (never floats) and convert exactly to grams
 * using integer arithmetic.
 */

export const GRAM_FACTORS: Record<string, string> = {
  KG: "1000",
  G: "1",
  TOZ: "31.1034768",
  MT: "1000000",
};

export const NORMALIZABLE_METALS = new Set(["AU", "AG", "PT", "PD"]);

export function isNormalizableUnit(unit: string): boolean {
  return unit in GRAM_FACTORS;
}

/** Exact decimal string multiplication via integer arithmetic. */
export function multiplyDecimal(left: string, right: string): string {
  const negative = left.startsWith("-") !== right.startsWith("-");
  const a = left.replace("-", "");
  const b = right.replace("-", "");

  const [aInt, aFrac = ""] = a.split(".");
  const [bInt, bFrac = ""] = b.split(".");
  const aDigits = aInt + aFrac;
  const bDigits = bInt + bFrac;
  const scale = aFrac.length + bFrac.length;

  const product = BigInt(aDigits) * BigInt(bDigits);
  const productStr = product.toString();
  let result =
    scale === 0
      ? productStr
      : productStr.length <= scale
        ? `0.${"0".repeat(scale - productStr.length)}${productStr}`
        : `${productStr.slice(0, productStr.length - scale)}.${productStr.slice(productStr.length - scale)}`;

  // Strip trailing fractional zeros for a canonical form.
  const [intPart, fracPart] = result.split(".");
  if (fracPart !== undefined) {
    const trimmed = fracPart.replace(/0+$/, "");
    result = trimmed.length > 0 ? `${intPart}.${trimmed}` : intPart;
  }

  return negative && result !== "0" ? `-${result}` : result;
}

/**
 * Converts a quantity to grams. Returns null when the unit is not a weight
 * (e.g. PCS) or the quantity is not a valid positive decimal string.
 */
export function toGrams(quantity: string, unit: string): string | null {
  if (!/^\d+(\.\d+)?$/.test(quantity)) {
    return null;
  }
  const factor = GRAM_FACTORS[unit];
  if (!factor) {
    return null;
  }
  return multiplyDecimal(quantity, factor);
}
