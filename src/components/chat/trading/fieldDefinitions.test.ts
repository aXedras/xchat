import { describe, expect, it } from "vitest";
import { fieldsForTab } from "./fieldDefinitions";

const TRANSACTION_TYPES = [
  "REFINE_AND_RETURN",
  "SELL_DORE",
  "REFINE_AND_SELL",
  "BUY_REFINED_METAL",
  "SELL_REFINED_METAL",
  "FABRICATE_METAL",
  "BUY_FEEDSTOCK",
] as const;

describe("field definitions", () => {
  it("always exposes the four common tabs", () => {
    for (const type of TRANSACTION_TYPES) {
      for (const tab of ["commercial", "material", "assay", "logistics"] as const) {
        expect(fieldsForTab(type, tab).length).toBeGreaterThan(0);
      }
    }
  });

  it("adds macro-specific fields per transaction type", () => {
    expect(
      fieldsForTab("SELL_DORE", "material").some((f) => f.key === "doreWeight"),
    ).toBe(true);
    expect(
      fieldsForTab("REFINE_AND_RETURN", "assay").some(
        (f) => f.key === "finalAssayAuthority",
      ),
    ).toBe(true);
    expect(
      fieldsForTab("BUY_REFINED_METAL", "logistics").some(
        (f) => f.key === "allocation",
      ),
    ).toBe(true);
    expect(
      fieldsForTab("FABRICATE_METAL", "commercial").some(
        (f) => f.key === "desiredFabricationDate",
      ),
    ).toBe(true);
  });

  it("keeps macro-specific fields out of unrelated macros", () => {
    expect(
      fieldsForTab("SELL_DORE", "material").some((f) => f.key === "brand"),
    ).toBe(false);
  });

  it("marks the required common fields", () => {
    const material = fieldsForTab("SELL_DORE", "material");
    expect(material.find((f) => f.key === "quantity")?.required).toBe(true);
    expect(material.find((f) => f.key === "primaryMetal")?.required).toBe(true);
    expect(material.find((f) => f.key === "packaging")?.required).toBeFalsy();
  });
});
