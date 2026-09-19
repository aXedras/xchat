import { ProviderHealth } from "../compliance/types";

export type DocumentType = "rfq_summary" | "quotation" | "trade_confirmation";

export interface RenderDocumentInput {
  documentType: DocumentType;
  templateId: string;
  templateVersion: string;
  locale: string;
  timezone: string;
  schemaVersion: number;
  input: Record<string, unknown>;
}

export interface RenderedDocument {
  pdf: Uint8Array;
  sha256: string;
  sizeBytes: number;
  mimeType: "application/pdf";
  templateId: string;
  templateVersion: string;
}

/**
 * Document rendering port (bauplan section 12.1). The Typst renderer is the
 * only Release-1 implementation; it runs server-side (worker), never in the
 * browser.
 */
export interface DocumentRenderer {
  render(input: RenderDocumentInput): Promise<RenderedDocument>;
  health(): Promise<ProviderHealth>;
}
