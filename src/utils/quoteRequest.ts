import {
  AskMacroDetails,
  ComplianceFlag,
  GoldSilverTradeDealTerms,
  Message,
  PlatinumPalladiumTradeDealTerms,
  QuoteRequest,
  QuoteRequestStatus,
  QuoteResponse,
  TradeDealTerms,
} from "@/types/chat";
import { getQuoteRequestExpiry, parseAskMacro } from "@/utils/askMacro";
import { feeService } from "@/services/feeService";

export function deriveQuoteRequestStatus(request: QuoteRequest, now = Date.now()): QuoteRequestStatus {
  if (["draft", "quoted", "withdrawn", "converted"].includes(request.status)) {
    return request.status;
  }

  if (!request.responseDeadline) {
    return request.status === "sent" ? "open" : request.status;
  }

  const deadline = new Date(request.responseDeadline).getTime();
  if (Number.isNaN(deadline)) {
    return request.status === "sent" ? "open" : request.status;
  }

  if (deadline <= now) {
    return "expired";
  }

  if (deadline - now <= 5 * 60_000) {
    return "expiring";
  }

  return "open";
}

export function buildQuoteRequestFromParsedMacro(
  parsedMacro: AskMacroDetails,
  message: Message,
  chatId: string,
  companyName?: string,
): QuoteRequest {
  const responseDeadlineMs = getQuoteRequestExpiry(message.createdAt, parsedMacro.ttlSeconds);
  const crmFeeSummary = companyName
    ? feeService.buildFeeSummary(companyName, parsedMacro.productClass, {
        quantity: parsedMacro.quantity,
        asOf: message.createdAt ? new Date(message.createdAt) : new Date(),
      })
    : undefined;
  const fees = [parsedMacro.fees, crmFeeSummary].filter(Boolean).join(" + ") || undefined;

  return {
    id: message.quoteRequestId ?? `qr-${message.id}`,
    chatId,
    sourceMessageId: message.id,
    type: parsedMacro.macroType,
    status: "sent",
    requestedBy: message.sender,
    requestedByEmail: message.senderEmail,
    requestedFrom: message.isMine ? "Counterparty" : "You",
    createdAt: message.createdAt ?? new Date().toISOString(),
    responseDeadline: responseDeadlineMs ? new Date(responseDeadlineMs).toISOString() : undefined,
    terms: {
      quantity: parsedMacro.quantity,
      product: parsedMacro.product,
      productCode: parsedMacro.productCode,
      productClass: parsedMacro.productClass,
      quality: parsedMacro.quality,
      location: parsedMacro.location,
      priceBasis: parsedMacro.priceBasis,
      premium: parsedMacro.premium,
      fees,
      vat: parsedMacro.vat,
      notes: parsedMacro.notes,
      rawTerms: parsedMacro.terms,
    },
  };
}

export function resolveQuoteRequest(
  message: Message,
  chatId: string,
  quoteRequestsById?: Record<string, QuoteRequest>,
  companyName?: string,
) {
  if (message.quoteRequestId && quoteRequestsById?.[message.quoteRequestId]) {
    return quoteRequestsById[message.quoteRequestId];
  }

  const parsedMacro = parseAskMacro(message.content);
  if (!parsedMacro) {
    return undefined;
  }

  return buildQuoteRequestFromParsedMacro(parsedMacro, message, chatId, companyName);
}

function deriveTradeComplianceFlags(request: QuoteRequest, feeSummary?: string): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [{ label: "KYC current", severity: "positive" }];

  if (request.terms.vat) {
    flags.push({
      label: request.terms.vat.toLowerCase() === "exempt" ? "VAT treatment confirmed" : `VAT: ${request.terms.vat}`,
      severity: request.terms.vat.toLowerCase() === "exempt" ? "positive" : "warning",
    });
  }

  if (feeSummary || request.terms.fees) {
    flags.push({ label: `Fee schedule ${feeSummary ?? request.terms.fees}`, severity: "warning" });
  }

  if (request.terms.notes?.toLowerCase().includes("same-day")) {
    flags.push({ label: "Same-day execution required", severity: "warning" });
  }

  return flags;
}

function deriveDocumentation(request: QuoteRequest): string[] {
  const commonDocuments = ["Trade confirmation", "Commercial invoice"];

  if (request.terms.productClass === "gold" || request.terms.productClass === "silver") {
    return [...commonDocuments, "Bar list", "Packing list"];
  }

  if (request.terms.productClass === "platinum" || request.terms.productClass === "palladium") {
    return [...commonDocuments, "Assay certificate", "Ownership transfer advice"];
  }

  return [...commonDocuments, "Product specification sheet"];
}

function deriveBaseTradeTerms(request: QuoteRequest, response: QuoteResponse, feeSummary?: string): TradeDealTerms {
  const location = request.terms.location;

  return {
    priceReference: request.terms.priceBasis,
    premium: response.quotedPremium ?? request.terms.premium,
    incoterm: location === "London" ? "FCA London" : `EXW ${location}`,
    deliveryWindow: request.terms.notes?.toLowerCase().includes("same-day")
      ? "Same-day release subject to confirmation"
      : "Next business day release",
    paymentTerms: request.type === "RFQ" ? "T+1 against invoice" : "T+0 pre-funding",
    settlementType: request.terms.productClass === "gold" || request.terms.productClass === "silver"
      ? "Allocated metal"
      : "Allocated transfer",
    accountSettlement: `${location} metals account transfer`,
    documentation: deriveDocumentation(request),
    complianceFlags: deriveTradeComplianceFlags(request, feeSummary),
  };
}

export function buildTradeDealTerms(
  request: QuoteRequest,
  response: QuoteResponse,
  feeSummary?: string,
): GoldSilverTradeDealTerms | PlatinumPalladiumTradeDealTerms | TradeDealTerms {
  const baseTerms = deriveBaseTradeTerms(request, response, feeSummary);

  if (request.terms.productClass === "gold" || request.terms.productClass === "silver") {
    return {
      ...baseTerms,
      goodDeliveryStandard: request.terms.quality,
      barForm: request.terms.quantity.includes("KG") ? "1KG bars" : `${request.terms.quantity} units`,
      vaultLocation: request.terms.location,
      chainOfCustody: "Direct refinery chain preserved",
    };
  }

  if (request.terms.productClass === "platinum" || request.terms.productClass === "palladium") {
    return {
      ...baseTerms,
      lppmStatus: request.terms.quality,
      formFactor: `${request.terms.quantity} ${request.terms.product}`,
      assayCertificate: "Latest assay certificate attached to trade",
      originDisclosure: request.terms.notes ?? "Origin disclosure to follow with booking note",
    };
  }

  return baseTerms;
}