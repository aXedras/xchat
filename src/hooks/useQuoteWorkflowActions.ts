import { getCurrentParticipant } from "@/services/chatIdentity";
import { feeService } from "@/services/feeService";
import { realtimeBus } from "@/services/realtimeBus";
import { counterpartyInsights } from "@/data/mockChats";
import { buildTradeDealTerms } from "@/utils/quoteRequest";
import { QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";

interface UseQuoteWorkflowActionsParams {
  realtimeOriginId: string;
  quoteRequests: Record<string, QuoteRequest>;
  quoteResponses: Record<string, QuoteResponse>;
  addQuoteResponse: (response: QuoteResponse) => QuoteResponse;
  updateQuoteResponse: (responseId: string, updates: Partial<QuoteResponse>) => QuoteResponse | undefined;
  addTradeDeal: (deal: TradeDeal) => TradeDeal;
  appendWorkflowMessage: (chatId: string, requestId: string, content: string, createdAt?: string) => { id: string; content: string };
}

function buildCounterPremium(premium?: string) {
  if (!premium) {
    return "Indicative + counter";
  }

  const match = /([+-]?\d+(?:\.\d+)?)(%?)/.exec(premium);
  if (!match) {
    return `${premium} counter`;
  }

  const currentValue = Number(match[1]);
  const unit = match[2];
  if (Number.isNaN(currentValue)) {
    return `${premium} counter`;
  }

  const adjustedValue = currentValue + 0.05;
  return premium.replace(match[0], `${adjustedValue >= 0 ? "+" : ""}${adjustedValue.toFixed(2)}${unit}`);
}

export function useQuoteWorkflowActions({
  realtimeOriginId,
  quoteRequests,
  quoteResponses,
  addQuoteResponse,
  updateQuoteResponse,
  addTradeDeal,
  appendWorkflowMessage,
}: Readonly<UseQuoteWorkflowActionsParams>) {
  const respondToQuoteRequest = (chatId: string, requestId: string) => {
    const request = quoteRequests[requestId];
    if (!request) {
      return;
    }

    const createdAt = new Date().toISOString();
    const participant = getCurrentParticipant();
    const companyName = counterpartyInsights[chatId]?.company;
    const feeApplied = companyName
      ? feeService.applyFeesToPremium(request.terms.premium, companyName, request.terms.productClass, {
          quantity: request.terms.quantity,
          asOf: new Date(createdAt),
        })
      : { quotedPremium: request.terms.premium, feeSummary: undefined };

    const response = addQuoteResponse({
      id: `resp-${Date.now()}`,
      requestId,
      version: 1,
      responder: participant?.displayName ?? "You",
      responderEmail: participant?.email,
      createdAt,
      status: "submitted",
      quotedPremium: feeApplied.quotedPremium,
      notes: feeApplied.feeSummary
        ? `Indicative quote submitted for ${request.terms.quantity} ${request.terms.product}. Fees applied: ${feeApplied.feeSummary}`
        : `Indicative quote submitted for ${request.terms.quantity} ${request.terms.product}`,
    });

    const workflowMessage = appendWorkflowMessage(
      chatId,
      requestId,
      `Quote sent for ${request.terms.quantity} ${request.terms.product} at premium ${response.quotedPremium}`,
      createdAt,
    );

    realtimeBus.publish({ originId: realtimeOriginId, type: "quote-response.upsert", chatId, quoteResponse: response });
    realtimeBus.publish({ originId: realtimeOriginId, type: "message.upsert", chatId, message: workflowMessage });
  };

  const counterQuoteResponse = (chatId: string, requestId: string, responseId: string) => {
    const response = quoteResponses[responseId];
    const request = quoteRequests[requestId];
    if (!response || !request) {
      return;
    }

    const quotedPremium = buildCounterPremium(response.quotedPremium ?? request.terms.premium);
    const companyName = counterpartyInsights[chatId]?.company;
    const feeSummary = companyName
      ? feeService.buildFeeSummary(companyName, request.terms.productClass, {
          quantity: request.terms.quantity,
          asOf: new Date(),
        })
      : undefined;
    const createdAt = new Date().toISOString();
    const participant = getCurrentParticipant();
    const nextResponse = addQuoteResponse({
      id: `resp-${Date.now()}`,
      requestId,
      parentResponseId: responseId,
      version: response.version + 1,
      responder: participant?.displayName ?? response.responder,
      responderEmail: participant?.email ?? response.responderEmail,
      createdAt,
      status: "countered",
      quotedPremium,
      notes: feeSummary
        ? `Counter quote proposed for ${request.terms.quantity} ${request.terms.product}. Fees in scope: ${feeSummary}`
        : `Counter quote proposed for ${request.terms.quantity} ${request.terms.product}`,
    });

    const workflowMessage = appendWorkflowMessage(
      chatId,
      requestId,
      `Counter quote v${nextResponse.version} proposed for ${request.terms.quantity} ${request.terms.product} at premium ${nextResponse.quotedPremium}`,
      createdAt,
    );

    realtimeBus.publish({ originId: realtimeOriginId, type: "quote-response.upsert", chatId, quoteResponse: nextResponse });
    realtimeBus.publish({ originId: realtimeOriginId, type: "message.upsert", chatId, message: workflowMessage });
  };

  const rejectQuoteResponse = (chatId: string, requestId: string, responseId: string) => {
    const response = quoteResponses[responseId];
    const request = quoteRequests[requestId];
    if (!response || !request) {
      return;
    }

    const updatedResponse = updateQuoteResponse(responseId, {
      status: "rejected",
      notes: `Quote rejected for ${request.terms.quantity} ${request.terms.product}`,
    });

    if (!updatedResponse) {
      return;
    }

    const workflowMessage = appendWorkflowMessage(chatId, requestId, `Quote rejected for ${request.terms.quantity} ${request.terms.product}`);
    realtimeBus.publish({ originId: realtimeOriginId, type: "quote-response.upsert", chatId, quoteResponse: updatedResponse });
    realtimeBus.publish({ originId: realtimeOriginId, type: "message.upsert", chatId, message: workflowMessage });
  };

  const convertQuoteResponseToDeal = (chatId: string, requestId: string, responseId: string) => {
    const request = quoteRequests[requestId];
    const response = quoteResponses[responseId];
    if (!request || !response) {
      return;
    }

    const createdAt = new Date().toISOString();
    const participant = getCurrentParticipant();
    const companyName = counterpartyInsights[chatId]?.company;
    const feeSummary = companyName
      ? feeService.buildFeeSummary(companyName, request.terms.productClass, {
          quantity: request.terms.quantity,
          asOf: new Date(createdAt),
        })
      : undefined;

    const deal = addTradeDeal({
      id: `deal-${Date.now()}`,
      requestId,
      responseId,
      responseVersion: response.version,
      counterparty: request.requestedBy,
      bookedByEmail: participant?.email,
      product: request.terms.product,
      volume: request.terms.quantity,
      createdAt,
      status: "booked",
      terms: buildTradeDealTerms(request, response, feeSummary),
    });

    const workflowMessage = appendWorkflowMessage(
      chatId,
      requestId,
      `Deal booked with ${deal.counterparty} for ${deal.volume} ${deal.product} on quote v${deal.responseVersion}`,
      createdAt,
    );

    realtimeBus.publish({ originId: realtimeOriginId, type: "trade-deal.upsert", chatId, tradeDeal: deal });
    realtimeBus.publish({ originId: realtimeOriginId, type: "message.upsert", chatId, message: workflowMessage });
  };

  return {
    respondToQuoteRequest,
    counterQuoteResponse,
    rejectQuoteResponse,
    convertQuoteResponseToDeal,
  };
}