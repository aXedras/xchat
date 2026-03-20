import { QuoteRequest } from "@/types/chat";
import { parseAskMacro } from "@/utils/askMacro";

function translateDocumentRequest(content: string) {
  if (content.includes("Airwaybill")) {
    const orderNumber = content.match(/#(\d+)/)?.[1] || "the order";
    return `Could you please send me the Airwaybill for shipping number #${orderNumber}?`;
  }

  if (content.includes("CoO for")) {
    const orderNumber = content.match(/#(\d+)/)?.[1] || "the order";
    return `Could you please send me the Certificate of Origin for order #${orderNumber}?`;
  }

  if (content.includes("Analysis for")) {
    const orderNumber = content.match(/#(\d+)/)?.[1] || "the order";
    return `Could you please send me the Material Analysis Certificate for order #${orderNumber}?`;
  }
}

function translateTradeIntent(content: string, keyword: "BID" | "OFFER") {
  const parts = content.split(" ");
  const quantity = parts[1];
  const metal = parts[2];
  const metalNames: Record<string, string> = { AU: "gold", AG: "silver", PT: "platinum", PD: "palladium", RH: "rhodium" };

  if (parts.length >= 4) {
    const metalName = metalNames[metal] || metal;
    return keyword === "BID"
      ? `I'd like to place a bid to buy ${quantity} of ${metalName} with the following specifications: ${parts.slice(3).join(" ")}`
      : `I'd like to offer for sale ${quantity} of ${metalName} with the following specifications: ${parts.slice(3).join(" ")}`;
  }

  return keyword === "BID"
    ? `I'd like to buy ${content.substring(4).trim()}. This is my offer price.`
    : `I'd like to sell ${content.substring(6).trim()}. This is my asking price.`;
}

export function translateMessageContent(content: string, quoteRequest?: QuoteRequest) {
  const documentRequest = translateDocumentRequest(content);
  if (documentRequest) {
    return documentRequest;
  }

  if (content.startsWith("ASK") || content.startsWith("RFQ")) {
    if (quoteRequest) {
      return `${quoteRequest.type} request for ${quoteRequest.terms.quantity} ${quoteRequest.terms.product} at ${quoteRequest.terms.location}. Basis: ${quoteRequest.terms.priceBasis}, premium ${quoteRequest.terms.premium}.`;
    }

    const askDetails = parseAskMacro(content);
    if (askDetails) {
      return `${askDetails.macroType} request for ${askDetails.quantity} ${askDetails.product} at ${askDetails.location}. Basis: ${askDetails.priceBasis}, premium ${askDetails.premium}.`;
    }

    return `I'm looking for ${content.substring(4).trim()}. Can you provide pricing?`;
  }

  if (content.startsWith("BID")) {
    return translateTradeIntent(content, "BID");
  }

  if (content.startsWith("OFFER")) {
    return translateTradeIntent(content, "OFFER");
  }

  return content;
}