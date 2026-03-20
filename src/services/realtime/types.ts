import { Chat, Message, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";

interface RealtimeBaseEvent {
  originId: string;
  chatId: string;
}

export interface RealtimeChatEvent extends RealtimeBaseEvent {
  type: "chat.upsert";
  chat: Chat;
}

export interface RealtimeMessageEvent extends RealtimeBaseEvent {
  type: "message.upsert";
  message: Message;
}

export interface RealtimeQuoteRequestEvent extends RealtimeBaseEvent {
  type: "quote-request.upsert";
  quoteRequest: QuoteRequest;
}

export interface RealtimeQuoteResponseEvent extends RealtimeBaseEvent {
  type: "quote-response.upsert";
  quoteResponse: QuoteResponse;
}

export interface RealtimeTradeDealEvent extends RealtimeBaseEvent {
  type: "trade-deal.upsert";
  tradeDeal: TradeDeal;
}

export type RealtimeEvent =
  | RealtimeChatEvent
  | RealtimeMessageEvent
  | RealtimeQuoteRequestEvent
  | RealtimeQuoteResponseEvent
  | RealtimeTradeDealEvent;

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface RealtimeCarrier {
  subscribe(listener: RealtimeListener): () => void;
  publish(event: RealtimeEvent): void | Promise<void>;
  destroy?(): void;
}

export function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RealtimeEvent>;
  if (typeof candidate.originId !== "string" || typeof candidate.chatId !== "string" || typeof candidate.type !== "string") {
    return false;
  }

  if (candidate.type === "chat.upsert") {
    return !!candidate.chat && typeof candidate.chat.id === "string" && typeof candidate.chat.name === "string";
  }

  if (candidate.type === "message.upsert") {
    return !!candidate.message && typeof candidate.message.id === "string" && typeof candidate.message.content === "string";
  }

  if (candidate.type === "quote-request.upsert") {
    return !!candidate.quoteRequest && typeof candidate.quoteRequest.id === "string";
  }

  if (candidate.type === "quote-response.upsert") {
    return !!candidate.quoteResponse && typeof candidate.quoteResponse.id === "string";
  }

  if (candidate.type === "trade-deal.upsert") {
    return !!candidate.tradeDeal && typeof candidate.tradeDeal.id === "string";
  }

  return false;
}
