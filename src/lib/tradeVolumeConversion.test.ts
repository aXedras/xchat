import { describe, expect, it } from "vitest";
import { multiplyDecimal, toGrams } from "./tradeVolumeConversion";

describe("trade volume conversion", () => {
  it("multiplies decimal strings exactly", () => {
    expect(multiplyDecimal("12.5", "1000")).toBe("12500");
    expect(multiplyDecimal("1", "31.1034768")).toBe("31.1034768");
    expect(multiplyDecimal("0.1", "0.1")).toBe("0.01");
    expect(multiplyDecimal("100", "0.5")).toBe("50");
  });

  it("converts kilograms to grams", () => {
    expect(toGrams("1", "KG")).toBe("1000");
    expect(toGrams("12.5", "KG")).toBe("12500");
  });

  it("converts troy ounces to grams", () => {
    expect(toGrams("1", "TOZ")).toBe("31.1034768");
  });

  it("returns null for non-weight units", () => {
    expect(toGrams("10", "PCS")).toBeNull();
  });

  it("returns null for invalid quantities", () => {
    expect(toGrams("-1", "KG")).toBeNull();
    expect(toGrams("abc", "KG")).toBeNull();
  });
});
