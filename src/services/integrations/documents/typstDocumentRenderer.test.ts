import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { TypstDocumentRenderer } from "./typstDocumentRenderer";

const templatesDir = resolve(process.cwd(), "document-worker/templates");

const renderer = new TypstDocumentRenderer({
  typstBin: process.env.TYPST_BIN ?? "typst",
  templatesDir,
});

const rfqInput = {
  documentType: "rfq_summary",
  publicReference: "RFQ-ABC123",
  transactionType: "SELL_DORE",
  terms: {
    commercial: {
      responseDeadline: "2026-12-31T12:00:00Z",
      settlementCurrency: "USD",
    },
    material: {
      primaryMetal: "AU",
      materialForm: "DORE",
      productName: "Gold doré",
      quantity: "12.5",
      quantityUnit: "KG",
    },
    assay: { assayStatus: "PROVISIONAL", assayMethod: "FIRE_ASSAY" },
    logistics: {
      currentLocation: { countryCode: "CH", locality: "Zurich" },
      availabilityFrom: "2026-10-01T00:00:00Z",
    },
  },
};

const quotationInput = {
  documentType: "quotation",
  publicReference: "RFQ-ABC123",
  transactionType: "SELL_DORE",
  commercial: { validUntil: "2026-12-31T12:00:00Z" },
  assay: { payability: "99.9%", deductions: "none" },
  pricingComponents: [
    {
      componentType: "PREMIUM",
      label: "Refining premium",
      calculationMethod: "FIXED_AMOUNT",
      numericValue: "1.25",
      currencyCode: "USD",
    },
  ],
};

const confirmationInput = {
  documentType: "trade_confirmation",
  dealReference: "DEAL-ABC123",
  transactionType: "SELL_DORE",
  bookedAt: "2026-09-18T12:00:00Z",
  commercialTermsSnapshot: {
    requesterOrganizationId: "20000000-0000-0000-0000-000000000001",
    counterpartyOrganizationId: "20000000-0000-0000-0000-000000000002",
  },
};

describe.skipIf(!process.env.CI && process.env.SKIP_TYPST === "1")(
  "TypstDocumentRenderer",
  () => {
    it("renders an RFQ summary to a valid PDF", async () => {
      const result = await renderer.render({
        documentType: "rfq_summary",
        templateId: "default",
        templateVersion: "1",
        locale: "en",
        timezone: "UTC",
        schemaVersion: 1,
        input: rfqInput,
      });
      expect(result.mimeType).toBe("application/pdf");
      expect(result.sizeBytes).toBeGreaterThan(100);
      expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it("renders a quotation to a valid PDF", async () => {
      const result = await renderer.render({
        documentType: "quotation",
        templateId: "default",
        templateVersion: "1",
        locale: "en",
        timezone: "UTC",
        schemaVersion: 1,
        input: quotationInput,
      });
      expect(result.mimeType).toBe("application/pdf");
      expect(result.sizeBytes).toBeGreaterThan(100);
    });

    it("renders a trade confirmation to a valid PDF", async () => {
      const result = await renderer.render({
        documentType: "trade_confirmation",
        templateId: "default",
        templateVersion: "1",
        locale: "en",
        timezone: "UTC",
        schemaVersion: 1,
        input: confirmationInput,
      });
      expect(result.mimeType).toBe("application/pdf");
      expect(result.sizeBytes).toBeGreaterThan(100);
    });
  },
);
