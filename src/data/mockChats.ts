
import { Chat, CounterpartyInsight, Message, QuoteRequest, QuoteResponse, TradeDeal } from "../types/chat";
import { applyChatSeedScenario, resolveChatSeedScenario } from "./chatSeedFactory";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const defaultInitialChats: Chat[] = [
  {
    id: "1",
    name: "Jane Smith - Argor-Heraeus",
    lastMessage: "ASK 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3",
    timestamp: "10:23 AM",
    unread: 2,
    avatar: "https://source.unsplash.com/random/40x40/?portrait&1"
  },
  {
    id: "2",
    name: "Michael Thompson - PAMP",
    lastMessage: "Will send you the certification details soon",
    timestamp: "Yesterday",
    unread: 0,
    avatar: "https://source.unsplash.com/random/40x40/?portrait&2"
  },
  {
    id: "3",
    name: "Refiners Group",
    lastMessage: "John: Can anyone share recent audit experiences?",
    timestamp: "Monday",
    unread: 5,
    isGroup: true,
    members: ["You", "John Davis", "Sarah Miller", "Robert Chen"]
  },
  {
    id: "4",
    name: "North American Operations",
    lastMessage: "Price update for March contracts",
    timestamp: "03/15/2023",
    unread: 0,
    isCompany: true
  },
  {
    id: "5",
    name: "Sarah Miller - Valcambi",
    lastMessage: "Ask Airwaybill for #123456",
    timestamp: "03/10/2023",
    unread: 0,
    avatar: "https://source.unsplash.com/random/40x40/?portrait&3"
  }
];

const defaultInitialMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "1-1",
      content: "Hello, I'm looking for gold bars for our client",
      sender: "Jane Smith",
      timestamp: "10:20 AM",
      createdAt: minutesAgo(16),
      status: "read",
      isMine: false
    },
    {
      id: "1-2",
      content: "We have several options available. What specifications are you looking for?",
      sender: "You",
      timestamp: "10:21 AM",
      createdAt: minutesAgo(15),
      status: "read",
      isMine: true
    },
    {
      id: "1-3",
      content: "ASK 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3 | TTL: 10m | FEE: 25 bps | VAT: exempt | NOTE: client needs same-day confirmation",
      sender: "Jane Smith",
      timestamp: "10:23 AM",
      createdAt: minutesAgo(3),
      quoteRequestId: "qr-argor-1",
      status: "read",
      isMine: false,
      isMacro: true
    },
    {
      id: "1-4",
      content: "We can show you our last allocations if useful.",
      sender: "You",
      timestamp: "10:24 AM",
      createdAt: minutesAgo(2),
      status: "sent",
      isMine: true
    }
  ],
  "2": [
    {
      id: "2-1",
      content: "I need information about your platinum supply chain",
      sender: "Michael Thompson",
      timestamp: "Yesterday 3:45 PM",
      createdAt: minutesAgo(120),
      status: "read",
      isMine: false
    },
    {
      id: "2-2",
      content: "I'll prepare a document with our supply chain details. Do you need specific certification?",
      sender: "You",
      timestamp: "Yesterday 4:00 PM",
      createdAt: minutesAgo(118),
      status: "read",
      isMine: true
    },
    {
      id: "2-3",
      content: "Yes, we need LBMA chain of custody documentation",
      sender: "Michael Thompson",
      timestamp: "Yesterday 4:15 PM",
      createdAt: minutesAgo(116),
      status: "read",
      isMine: false
    },
    {
      id: "2-4",
      content: "Will send you the certification details soon",
      sender: "Michael Thompson",
      timestamp: "Yesterday 4:16 PM",
      createdAt: minutesAgo(115),
      status: "delivered",
      isMine: false
    }
  ]
};

const defaultInitialQuoteRequests: Record<string, QuoteRequest> = {
  "qr-argor-1": {
    id: "qr-argor-1",
    chatId: "1",
    sourceMessageId: "1-3",
    type: "ASK",
    status: "sent",
    requestedBy: "Jane Smith",
    requestedFrom: "You",
    createdAt: minutesAgo(3),
    responseDeadline: new Date(Date.now() + 7 * 60_000).toISOString(),
    terms: {
      quantity: "10x1KG",
      product: "Gold",
      productCode: "AU",
      productClass: "gold",
      quality: "LBMA good delivery",
      location: "London",
      priceBasis: "LND fixing 18.03",
      premium: "+0.3",
      fees: "25 bps",
      vat: "exempt",
      notes: "client needs same-day confirmation",
      rawTerms: "LBMA good delivery LND fixing 18.03 +0.3",
    },
  },
};

const defaultInitialQuoteResponses: Record<string, QuoteResponse> = {};

const defaultInitialTradeDeals: Record<string, TradeDeal> = {};

const defaultCounterpartyInsights: Record<string, CounterpartyInsight> = {
  "1": {
    chatId: "1",
    counterparty: "Jane Smith",
    company: "Argor-Heraeus",
    kycStatus: "onboarded",
    onboardingNote: "Approved by compliance on 12 Feb 2026. Active precious metals trading line with settled exposure.",
    requestHistory: [
      {
        id: "req-argor-1",
        date: "14 Mar 2026",
        summary: "ASK 5x1KG AU loco Zurich spot +0.15%",
        status: "won",
        linkedDealId: "deal-argor-1"
      },
      {
        id: "req-argor-2",
        date: "06 Mar 2026",
        summary: "ASK 20x100OZ AG loco London same-day",
        status: "quoted"
      },
      {
        id: "req-argor-3",
        date: "27 Feb 2026",
        summary: "ASK 2x1KG PT LPPM fixing +0.35%",
        status: "won",
        linkedDealId: "deal-argor-2"
      },
      {
        id: "req-argor-4",
        date: "19 Feb 2026",
        summary: "ASK 10x1KG AU LND fixing +0.25%",
        status: "lost"
      }
    ],
    dealHistory: [
      {
        id: "deal-argor-1",
        requestId: "req-argor-1",
        date: "14 Mar 2026",
        product: "Gold bars",
        productClass: "gold",
        volume: "5x1KG",
        outcome: "Deal booked",
        terms: {
          priceReference: "Zurich AM fixing",
          premium: "+0.17% over spot",
          incoterm: "EXW Zurich vault",
          deliveryWindow: "Same-day release before 16:00 CET",
          paymentTerms: "T+0 pre-funding",
          settlementType: "Allocated metal",
          accountSettlement: "Existing precious metals account",
          documentation: ["Commercial invoice", "Packing list", "Bar list"],
          complianceFlags: [
            { label: "KYC current", severity: "positive" },
            { label: "Sanctions screened", severity: "positive" },
            { label: "Travel rule not required", severity: "warning" }
          ],
          goodDeliveryStandard: "LBMA good delivery",
          barForm: "1KG cast bars",
          vaultLocation: "Zurich bonded vault",
          chainOfCustody: "Direct refinery chain preserved"
        }
      },
      {
        id: "deal-argor-2",
        requestId: "req-argor-3",
        date: "27 Feb 2026",
        product: "Platinum bars",
        productClass: "platinum",
        volume: "2x1KG",
        outcome: "Deal booked",
        terms: {
          priceReference: "LPPM PM fixing",
          premium: "+0.32%",
          incoterm: "FCA London",
          deliveryWindow: "Next business day handover",
          paymentTerms: "T+1 against invoice",
          settlementType: "Unallocated to allocated switch",
          accountSettlement: "London metal account transfer",
          documentation: ["Invoice", "Certificate of analysis", "Ownership transfer advice"],
          complianceFlags: [
            { label: "Enhanced due diligence cleared", severity: "positive" },
            { label: "Source of funds refreshed", severity: "positive" },
            { label: "Origin disclosure required on release", severity: "warning" }
          ],
          lppmStatus: "LPPM acceptable brand",
          formFactor: "1KG platinum bars",
          assayCertificate: "Latest assay cert on file",
          originDisclosure: "Swiss transformation, mined origin disclosed"
        }
      }
    ]
  },
  "2": {
    chatId: "2",
    counterparty: "Michael Thompson",
    company: "PAMP",
    kycStatus: "in-review",
    onboardingNote: "Corporate docs received. Final compliance sign-off pending beneficial owner refresh.",
    requestHistory: [
      {
        id: "req-pamp-1",
        date: "11 Mar 2026",
        summary: "Request for LBMA chain of custody pack",
        status: "open"
      }
    ],
    dealHistory: []
  }
};

const seededData = applyChatSeedScenario(
  {
    initialChats: defaultInitialChats,
    initialMessages: defaultInitialMessages,
    initialQuoteRequests: defaultInitialQuoteRequests,
    initialQuoteResponses: defaultInitialQuoteResponses,
    initialTradeDeals: defaultInitialTradeDeals,
    counterpartyInsights: defaultCounterpartyInsights,
  },
  resolveChatSeedScenario(),
);

export const initialChats = seededData.initialChats;
export const initialMessages = seededData.initialMessages;
export const initialQuoteRequests = seededData.initialQuoteRequests;
export const initialQuoteResponses = seededData.initialQuoteResponses;
export const initialTradeDeals = seededData.initialTradeDeals;
export const counterpartyInsights = seededData.counterpartyInsights;
