import { describe, expect, it } from "vitest";
import { rfqMacroSchemas } from "./rfq/macros";
import { quotationMacroSchemas } from "./quotation/macros";
import { getTradingSchema, SchemaRegistryError } from "./registry";
import {
  canonicalize,
  canonicalJson,
  hashCanonical,
  normalizeDecimalString,
} from "./canonicalizer";

const TRANSACTION_TYPES = [
  "REFINE_AND_RETURN",
  "SELL_DORE",
  "REFINE_AND_SELL",
  "BUY_REFINED_METAL",
  "SELL_REFINED_METAL",
  "FABRICATE_METAL",
  "BUY_FEEDSTOCK",
] as const;

function rfqFixture(transactionType: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    commercial: {
      transactionType,
      responseDeadline: "2026-12-31T12:00:00Z",
      settlementCurrency: "USD",
      partialFulfilmentAllowed: false,
    },
    material: {
      primaryMetal: "AU",
      materialForm: "DORE",
      productName: "Gold doré",
      quantity: "12.5",
      quantityUnit: "KG",
    },
    assay: {
      assayStatus: "PROVISIONAL",
    },
    logistics: {
      currentLocation: { countryCode: "CH", locality: "Zurich" },
      availabilityFrom: "2026-10-01T00:00:00Z",
    },
  };
}

function quotationFixture(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    commercial: {
      validUntil: "2026-12-31T12:00:00Z",
    },
    material: {},
    assay: {},
    logistics: {},
    pricingComponents: [
      {
        componentType: "PREMIUM",
        label: "Refining premium",
        calculationMethod: "FIXED_AMOUNT",
        numericValue: "1.25",
        currencyCode: "USD",
        chargeDirection: "PAYABLE_BY_REQUESTER",
      },
    ],
  };
}

describe("RFQ schemas", () => {
  for (const transactionType of TRANSACTION_TYPES) {
    const schema = rfqMacroSchemas[transactionType];

    it(`${transactionType}: accepts a valid payload`, () => {
      expect(schema.safeParse(rfqFixture(transactionType)).success).toBe(true);
    });

    it(`${transactionType}: rejects a missing required field`, () => {
      const fixture = rfqFixture(transactionType);
      delete (fixture.commercial as Record<string, unknown>).responseDeadline;
      expect(schema.safeParse(fixture).success).toBe(false);
    });

    it(`${transactionType}: rejects an unknown key`, () => {
      const fixture = rfqFixture(transactionType);
      (fixture.material as Record<string, unknown>).sneaky = "value";
      expect(schema.safeParse(fixture).success).toBe(false);
    });
  }
});

describe("Quotation schemas", () => {
  for (const transactionType of TRANSACTION_TYPES) {
    const schema = quotationMacroSchemas[transactionType];

    it(`${transactionType}: accepts a valid quotation`, () => {
      expect(schema.safeParse(quotationFixture()).success).toBe(true);
    });

    it(`${transactionType}: rejects a missing required field`, () => {
      const fixture = quotationFixture();
      delete (fixture.commercial as Record<string, unknown>).validUntil;
      expect(schema.safeParse(fixture).success).toBe(false);
    });

    it(`${transactionType}: rejects an unknown key`, () => {
      const fixture = quotationFixture();
      (fixture.commercial as Record<string, unknown>).sneaky = "value";
      expect(schema.safeParse(fixture).success).toBe(false);
    });
  }
});

describe("Pricing components", () => {
  it("requires numericValue for FIXED_AMOUNT", () => {
    const component = {
      componentType: "PREMIUM",
      label: "x",
      calculationMethod: "FIXED_AMOUNT",
      currencyCode: "USD",
      chargeDirection: "PAYABLE_BY_REQUESTER",
    };
    const fixture = quotationFixture();
    (fixture as Record<string, unknown>).pricingComponents = [component];
    expect(quotationMacroSchemas.SELL_DORE.safeParse(fixture).success).toBe(
      false,
    );
  });

  it("requires formulaText for FORMULA", () => {
    const component = {
      componentType: "METAL_PRICE",
      label: "x",
      calculationMethod: "FORMULA",
      chargeDirection: "PAYABLE_BY_REQUESTER",
    };
    const fixture = quotationFixture();
    (fixture as Record<string, unknown>).pricingComponents = [component];
    expect(quotationMacroSchemas.SELL_DORE.safeParse(fixture).success).toBe(
      false,
    );
  });

  it("requires label and notes for OTHER", () => {
    const component = {
      componentType: "OTHER",
      label: "",
      calculationMethod: "INCLUDED",
      chargeDirection: "PAYABLE_BY_REQUESTER",
    };
    const fixture = quotationFixture();
    (fixture as Record<string, unknown>).pricingComponents = [component];
    expect(quotationMacroSchemas.SELL_DORE.safeParse(fixture).success).toBe(
      false,
    );
  });
});

describe("Boundary validation", () => {
  const schema = rfqMacroSchemas.SELL_DORE;

  it("rejects a zero quantity", () => {
    const fixture = rfqFixture("SELL_DORE");
    (fixture.material as Record<string, unknown>).quantity = "0";
    expect(schema.safeParse(fixture).success).toBe(false);
  });

  it("rejects a negative quantity", () => {
    const fixture = rfqFixture("SELL_DORE");
    (fixture.material as Record<string, unknown>).quantity = "-5";
    expect(schema.safeParse(fixture).success).toBe(false);
  });

  it("rejects fineness above 1", () => {
    const fixture = rfqFixture("SELL_DORE");
    (fixture.material as Record<string, unknown>).declaredFineness = "1.5";
    expect(schema.safeParse(fixture).success).toBe(false);
  });

  it("rejects tolerance above 100", () => {
    const fixture = rfqFixture("SELL_DORE");
    (fixture.material as Record<string, unknown>).quantityTolerancePct = "101";
    expect(schema.safeParse(fixture).success).toBe(false);
  });

  it("rejects notes longer than 4000 characters", () => {
    const fixture = rfqFixture("SELL_DORE");
    (fixture.commercial as Record<string, unknown>).notes = "x".repeat(4001);
    expect(schema.safeParse(fixture).success).toBe(false);
  });

  it("rejects an invalid deadline", () => {
    const fixture = rfqFixture("SELL_DORE");
    (fixture.commercial as Record<string, unknown>).responseDeadline = "tomorrow";
    expect(schema.safeParse(fixture).success).toBe(false);
  });
});

describe("Canonicalizer", () => {
  it("is independent of key order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("removes empty optionals from objects", () => {
    expect(canonicalize({ a: null, b: "", c: {}, d: [1], e: undefined })).toEqual(
      { d: [1] },
    );
  });

  it("trims string values", () => {
    expect(canonicalize({ a: "  x  " })).toEqual({ a: "x" });
  });

  it("normalizes decimal strings", () => {
    expect(normalizeDecimalString("001.500")).toBe("1.5");
    expect(normalizeDecimalString("1.00")).toBe("1");
    expect(normalizeDecimalString("-0.0")).toBe("0");
  });

  it("produces a deterministic hash", async () => {
    const left = await hashCanonical({ b: 1, a: 2 });
    const right = await hashCanonical({ a: 2, b: 1 });
    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Schema registry", () => {
  it("resolves a known schema", () => {
    expect(() => getTradingSchema("SELL_DORE", "rfq", 1)).not.toThrow();
  });

  it("fails closed on an unknown schema version", () => {
    expect(() => getTradingSchema("SELL_DORE", "rfq", 2)).toThrow(
      SchemaRegistryError,
    );
  });

  it("fails closed on legacy version 0", () => {
    expect(() => getTradingSchema("SELL_DORE", "rfq", 0)).toThrow(
      SchemaRegistryError,
    );
  });

  it("fails closed on an unknown transaction type", () => {
    expect(() => getTradingSchema("BOGUS", "rfq", 1)).toThrow(
      SchemaRegistryError,
    );
  });
});
