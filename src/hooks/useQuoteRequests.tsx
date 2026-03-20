import { useEffect, useMemo, useState } from "react";
import {
  initialQuoteRequests,
  initialQuoteResponses,
  initialTradeDeals,
} from "@/data/mockChats";
import { Message, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";
import { parseAskMacro } from "@/utils/askMacro";
import { buildQuoteRequestFromParsedMacro } from "@/utils/quoteRequest";
import { quoteWorkflowRepository } from "@/services/persistence/quoteWorkflowRepository";

interface CreateOutgoingQuoteRequestInput {
  chatId: string;
  counterpartyName: string;
  companyName?: string;
  message: Message;
}

export function useQuoteRequests() {
  const [quoteRequests, setQuoteRequests] = useState<Record<string, QuoteRequest>>(initialQuoteRequests);
  const [quoteResponses, setQuoteResponses] = useState<Record<string, QuoteResponse>>(initialQuoteResponses);
  const [tradeDeals, setTradeDeals] = useState<Record<string, TradeDeal>>(initialTradeDeals);

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      const persisted = await quoteWorkflowRepository.loadState();
      if (isCancelled) {
        return;
      }

      setQuoteRequests((previous) => ({ ...previous, ...persisted.quoteRequests }));
      setQuoteResponses((previous) => ({ ...previous, ...persisted.quoteResponses }));
      setTradeDeals((previous) => ({ ...previous, ...persisted.tradeDeals }));
    };

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, []);

  const persistQuoteRequest = (request: QuoteRequest | undefined) => {
    if (!request) {
      return;
    }

    void quoteWorkflowRepository.upsertQuoteRequest(request);
  };

  const createOutgoingQuoteRequest = ({ chatId, counterpartyName, companyName, message }: CreateOutgoingQuoteRequestInput) => {
    const parsedMacro = parseAskMacro(message.content);
    if (!parsedMacro) {
      return undefined;
    }

    const quoteRequest = {
      ...buildQuoteRequestFromParsedMacro(parsedMacro, message, chatId, companyName),
      requestedFrom: counterpartyName,
      requestedBy: message.sender,
    };

    setQuoteRequests((prev) => ({
      ...prev,
      [quoteRequest.id]: quoteRequest,
    }));

    void quoteWorkflowRepository.upsertQuoteRequest(quoteRequest);

    return quoteRequest;
  };

  const addQuoteResponse = (response: QuoteResponse) => {
    let nextRequest: QuoteRequest | undefined;

    setQuoteResponses((prev) => ({
      ...prev,
      [response.id]: response,
    }));

    setQuoteRequests((prev) => ({
      ...prev,
      [response.requestId]: (() => {
        nextRequest = {
          ...prev[response.requestId],
          status: "quoted",
        };

        return nextRequest;
      })(),
    }));

    void quoteWorkflowRepository.upsertQuoteResponse(response);
    persistQuoteRequest(nextRequest);

    return response;
  };

  const upsertIncomingQuoteRequest = (request: QuoteRequest) => {
    setQuoteRequests((prev) => ({
      ...prev,
      [request.id]: request,
    }));

    void quoteWorkflowRepository.upsertQuoteRequest(request);
  };

  const upsertIncomingQuoteResponse = (response: QuoteResponse) => {
    setQuoteResponses((prev) => ({
      ...prev,
      [response.id]: response,
    }));

    setQuoteRequests((prev) => {
      const existingRequest = prev[response.requestId];
      if (!existingRequest) {
        return prev;
      }

      return {
        ...prev,
        [response.requestId]: {
          ...existingRequest,
          status: existingRequest.status === "converted" ? existingRequest.status : "quoted",
        },
      };
    });

    void quoteWorkflowRepository.upsertQuoteResponse(response);
  };

  const updateQuoteResponse = (responseId: string, updates: Partial<QuoteResponse>) => {
    let nextResponse: QuoteResponse | undefined;

    setQuoteResponses((prev) => {
      const existingResponse = prev[responseId];
      if (!existingResponse) {
        return prev;
      }

      nextResponse = {
        ...existingResponse,
        ...updates,
      };

      return {
        ...prev,
        [responseId]: nextResponse,
      };
    });

    if (nextResponse) {
      void quoteWorkflowRepository.upsertQuoteResponse(nextResponse);
    }

    return nextResponse;
  };

  const addTradeDeal = (deal: TradeDeal) => {
    let nextRequest: QuoteRequest | undefined;
    let acceptedResponse: QuoteResponse | undefined;

    setTradeDeals((prev) => ({
      ...prev,
      [deal.id]: deal,
    }));

    setQuoteRequests((prev) => ({
      ...prev,
      [deal.requestId]: (() => {
        nextRequest = {
          ...prev[deal.requestId],
          status: "converted",
        };

        return nextRequest;
      })(),
    }));

    if (deal.responseId) {
      setQuoteResponses((prev) => ({
        ...prev,
        [deal.responseId]: (() => {
          acceptedResponse = {
            ...prev[deal.responseId],
            status: "accepted",
          };

          return acceptedResponse;
        })(),
      }));
    }

    void quoteWorkflowRepository.upsertTradeDeal(deal);
    persistQuoteRequest(nextRequest);

    if (acceptedResponse) {
      void quoteWorkflowRepository.upsertQuoteResponse(acceptedResponse);
    }

    return deal;
  };

  const upsertIncomingTradeDeal = (deal: TradeDeal) => {
    setTradeDeals((prev) => ({
      ...prev,
      [deal.id]: deal,
    }));

    setQuoteRequests((prev) => {
      const existingRequest = prev[deal.requestId];
      if (!existingRequest) {
        return prev;
      }

      return {
        ...prev,
        [deal.requestId]: {
          ...existingRequest,
          status: "converted",
        },
      };
    });

    if (deal.responseId) {
      setQuoteResponses((prev) => {
        const existingResponse = prev[deal.responseId];
        if (!existingResponse) {
          return prev;
        }

        return {
          ...prev,
          [deal.responseId]: {
            ...existingResponse,
            status: "accepted",
          },
        };
      });
    }

    void quoteWorkflowRepository.upsertTradeDeal(deal);
  };

  const quoteRequestsByChat = useMemo(() => {
    return Object.values(quoteRequests).reduce<Record<string, Record<string, QuoteRequest>>>((accumulator, request) => {
      accumulator[request.chatId] ??= {};
      accumulator[request.chatId][request.id] = request;
      return accumulator;
    }, {});
  }, [quoteRequests]);

  const quoteResponsesByRequest = useMemo(() => {
    return Object.values(quoteResponses).reduce<Record<string, QuoteResponse[]>>((accumulator, response) => {
      accumulator[response.requestId] ??= [];
      accumulator[response.requestId].push(response);
      return accumulator;
    }, {});
  }, [quoteResponses]);

  const tradeDealsByRequest = useMemo(() => {
    return Object.values(tradeDeals).reduce<Record<string, TradeDeal[]>>((accumulator, deal) => {
      accumulator[deal.requestId] ??= [];
      accumulator[deal.requestId].push(deal);
      return accumulator;
    }, {});
  }, [tradeDeals]);

  Object.values(quoteResponsesByRequest).forEach((responses) => {
    responses.sort((left, right) => left.version - right.version || left.createdAt.localeCompare(right.createdAt));
  });

  Object.values(tradeDealsByRequest).forEach((deals) => {
    deals.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  });

  return {
    quoteRequests,
    setQuoteRequests,
    quoteResponses,
    setQuoteResponses,
    tradeDeals,
    setTradeDeals,
    quoteRequestsByChat,
    quoteResponsesByRequest,
    tradeDealsByRequest,
    createOutgoingQuoteRequest,
    addQuoteResponse,
    updateQuoteResponse,
    addTradeDeal,
    upsertIncomingQuoteRequest,
    upsertIncomingQuoteResponse,
    upsertIncomingTradeDeal,
  };
}