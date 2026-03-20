import { Chat, CounterpartyInsight, Message, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";

export type ChatSeedScenario = "default" | "firma-a-firma-b";

export interface ChatSeedData {
  initialChats: Chat[];
  initialMessages: Record<string, Message[]>;
  initialQuoteRequests: Record<string, QuoteRequest>;
  initialQuoteResponses: Record<string, QuoteResponse>;
  initialTradeDeals: Record<string, TradeDeal>;
  counterpartyInsights: Record<string, CounterpartyInsight>;
}

function cloneSeedData(seedData: ChatSeedData): ChatSeedData {
  return structuredClone(seedData);
}

export function resolveChatSeedScenario(): ChatSeedScenario {
  if (globalThis.localStorage === undefined || globalThis.location === undefined) {
    return "default";
  }

  const fromStorage = globalThis.localStorage.getItem("xchat.seedScenario");
  if (fromStorage === "firma-a-firma-b") {
    return fromStorage;
  }

  const fromQuery = new URLSearchParams(globalThis.location.search).get("seed");
  if (fromQuery === "firma-a-firma-b") {
    globalThis.localStorage.setItem("xchat.seedScenario", fromQuery);
    return fromQuery;
  }

  return "default";
}

function buildFirmaACompanyBSeed(baseData: ChatSeedData): ChatSeedData {
  const next = cloneSeedData(baseData);

  const chatId = "1";
  const requestId = "qr-firma-a-1";

  const primaryChat = next.initialChats.find((chat) => chat.id === chatId);
  if (primaryChat) {
    primaryChat.name = "Firma A - Firma B Metals";
    primaryChat.lastMessage = "RFQ 6x1KG AU LBMA good delivery ZRH fixing 20.03 +0.25 | TTL: 15m | FEE: 20 bps | NOTE: strategic account";
    primaryChat.timestamp = "10:41 AM";
    primaryChat.unread = 1;
  }

  next.initialMessages[chatId] = [
    {
      id: "1-1",
      content: "Hallo, wir brauchen eine indikative Preisstellung fuer unseren Mandanten.",
      sender: "Firma A Trader",
      timestamp: "10:37 AM",
      createdAt: new Date(Date.now() - 7 * 60_000).toISOString(),
      status: "read",
      isMine: false,
    },
    {
      id: "1-2",
      content: "Verstanden, bitte sende die genauen RFQ Parameter.",
      sender: "You",
      timestamp: "10:38 AM",
      createdAt: new Date(Date.now() - 6 * 60_000).toISOString(),
      status: "read",
      isMine: true,
    },
    {
      id: "1-3",
      content: "RFQ 6x1KG AU LBMA good delivery ZRH fixing 20.03 +0.25 | TTL: 15m | FEE: 20 bps | NOTE: strategic account",
      sender: "Firma A Trader",
      timestamp: "10:41 AM",
      createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      quoteRequestId: requestId,
      status: "read",
      isMine: false,
      isMacro: true,
    },
  ];

  next.initialQuoteRequests = {
    [requestId]: {
      id: requestId,
      chatId,
      sourceMessageId: "1-3",
      type: "RFQ",
      status: "sent",
      requestedBy: "Firma A Trader",
      requestedFrom: "You",
      createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      responseDeadline: new Date(Date.now() + 12 * 60_000).toISOString(),
      terms: {
        quantity: "6x1KG",
        product: "Gold",
        productCode: "AU",
        productClass: "gold",
        quality: "LBMA good delivery",
        location: "Zurich",
        priceBasis: "ZRH fixing 20.03",
        premium: "+0.25",
        fees: "20 bps",
        notes: "strategic account",
        rawTerms: "LBMA good delivery ZRH fixing 20.03 +0.25",
      },
    },
  };

  next.initialQuoteResponses = {};
  next.initialTradeDeals = {};

  next.counterpartyInsights[chatId] = {
    chatId,
    counterparty: "Firma A Trader",
    company: "Firma B Metals",
    kycStatus: "onboarded",
    onboardingNote: "Rahmenvertrag aktiv. Gebuehrenmatrix fuer Key-Account verifiziert.",
    requestHistory: [
      {
        id: "req-fa-fb-1",
        date: "18 Mar 2026",
        summary: "RFQ 8x1KG AU loco Zurich +0.20%",
        status: "won",
        linkedDealId: "deal-fa-fb-1",
      },
      {
        id: "req-fa-fb-2",
        date: "11 Mar 2026",
        summary: "RFQ 15x100OZ AG loco London same-day",
        status: "quoted",
      },
    ],
    dealHistory: [
      {
        id: "deal-fa-fb-1",
        requestId: "req-fa-fb-1",
        date: "18 Mar 2026",
        product: "Gold bars",
        productClass: "gold",
        volume: "8x1KG",
        outcome: "Deal booked",
        terms: {
          priceReference: "Zurich AM fixing",
          premium: "+0.22% over spot",
          incoterm: "EXW Zurich vault",
          deliveryWindow: "Same-day release before 16:00 CET",
          paymentTerms: "T+0 pre-funding",
          settlementType: "Allocated metal",
          accountSettlement: "Client segregated metals account",
          documentation: ["Trade confirmation", "Commercial invoice", "Bar list"],
          complianceFlags: [
            { label: "KYC current", severity: "positive" },
            { label: "Fee schedule linked", severity: "positive" },
          ],
          goodDeliveryStandard: "LBMA good delivery",
          barForm: "1KG cast bars",
          vaultLocation: "Zurich bonded vault",
          chainOfCustody: "Direct refinery chain preserved",
        },
      },
    ],
  };

  return next;
}

export function applyChatSeedScenario(baseData: ChatSeedData, scenario: ChatSeedScenario): ChatSeedData {
  if (scenario === "firma-a-firma-b") {
    return buildFirmaACompanyBSeed(baseData);
  }

  return baseData;
}
