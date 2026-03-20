import config from "@/config/environment";
import { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentParticipant } from "@/services/chatIdentity";
import { logger } from "@/services/logger";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/services/supabase/client";
import {
  QuoteRequest,
  QuoteResponse,
  TradeDeal,
} from "@/types/chat";

const STORAGE_KEY = "xchat.quote-workflow.v1";

type QuoteRequestsMap = Record<string, QuoteRequest>;
type QuoteResponsesMap = Record<string, QuoteResponse>;
type TradeDealsMap = Record<string, TradeDeal>;

export interface QuoteWorkflowState {
  quoteRequests: QuoteRequestsMap;
  quoteResponses: QuoteResponsesMap;
  tradeDeals: TradeDealsMap;
}

export interface QuoteWorkflowRepository {
  loadState(): Promise<QuoteWorkflowState>;
  upsertQuoteRequest(request: QuoteRequest): Promise<void>;
  upsertQuoteResponse(response: QuoteResponse): Promise<void>;
  upsertTradeDeal(deal: TradeDeal): Promise<void>;
}

function normalizeState(state: QuoteWorkflowState) {
  return {
    quoteRequests: { ...state.quoteRequests },
    quoteResponses: { ...state.quoteResponses },
    tradeDeals: { ...state.tradeDeals },
  } satisfies QuoteWorkflowState;
}

function emptyState(): QuoteWorkflowState {
  return {
    quoteRequests: {},
    quoteResponses: {},
    tradeDeals: {},
  };
}

function safeParseState(value: string | null): QuoteWorkflowState {
  if (!value) {
    return emptyState();
  }

  try {
    const parsed = JSON.parse(value) as Partial<QuoteWorkflowState>;
    return {
      quoteRequests: parsed.quoteRequests ?? {},
      quoteResponses: parsed.quoteResponses ?? {},
      tradeDeals: parsed.tradeDeals ?? {},
    };
  } catch {
    return emptyState();
  }
}

class LocalQuoteWorkflowRepository implements QuoteWorkflowRepository {
  private readState() {
    if (globalThis.window === undefined) {
      return emptyState();
    }

    return safeParseState(globalThis.localStorage.getItem(STORAGE_KEY));
  }

  private writeState(state: QuoteWorkflowState) {
    if (globalThis.window === undefined) {
      return;
    }

    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async loadState() {
    return normalizeState(this.readState());
  }

  async upsertQuoteRequest(request: QuoteRequest) {
    const state = this.readState();
    state.quoteRequests[request.id] = request;
    this.writeState(state);
  }

  async upsertQuoteResponse(response: QuoteResponse) {
    const state = this.readState();
    state.quoteResponses[response.id] = response;
    this.writeState(state);
  }

  async upsertTradeDeal(deal: TradeDeal) {
    const state = this.readState();
    state.tradeDeals[deal.id] = deal;
    this.writeState(state);
  }
}

class SupabaseQuoteWorkflowRepository implements QuoteWorkflowRepository {
  private readonly client: SupabaseClient;

  constructor(private readonly fallback: QuoteWorkflowRepository) {
    this.client = getSupabaseBrowserClient() as SupabaseClient;
  }

  async loadState() {
    try {
      const [requestsResult, responsesResult, dealsResult] = await Promise.all([
        this.client
          .from("quote_requests")
          .select("id, chat_id, source_message_id, type, status, requested_by, requested_by_email, requested_from, created_at, response_deadline, terms"),
        this.client
          .from("quote_responses")
          .select("id, request_id, parent_response_id, version, responder, responder_email, created_at, status, quoted_premium, notes"),
        this.client
          .from("trade_deals")
          .select("id, request_id, response_id, response_version, counterparty, booked_by_email, product, volume, created_at, status, terms"),
      ]);

      if (requestsResult.error || responsesResult.error || dealsResult.error) {
        return await this.fallback.loadState();
      }

      const quoteRequests = (requestsResult.data ?? []).reduce<QuoteRequestsMap>((accumulator, row) => {
        accumulator[String(row.id)] = {
          id: String(row.id),
          chatId: String(row.chat_id),
          sourceMessageId: String(row.source_message_id),
          type: row.type as QuoteRequest["type"],
          status: row.status as QuoteRequest["status"],
          requestedBy: String(row.requested_by),
          requestedByEmail: row.requested_by_email ? String(row.requested_by_email) : undefined,
          requestedFrom: String(row.requested_from),
          createdAt: String(row.created_at),
          responseDeadline: row.response_deadline ? String(row.response_deadline) : undefined,
          terms: row.terms as QuoteRequest["terms"],
        };
        return accumulator;
      }, {});

      const quoteResponses = (responsesResult.data ?? []).reduce<QuoteResponsesMap>((accumulator, row) => {
        accumulator[String(row.id)] = {
          id: String(row.id),
          requestId: String(row.request_id),
          parentResponseId: row.parent_response_id ? String(row.parent_response_id) : undefined,
          version: Number(row.version),
          responder: String(row.responder),
          responderEmail: row.responder_email ? String(row.responder_email) : undefined,
          createdAt: String(row.created_at),
          status: row.status as QuoteResponse["status"],
          quotedPremium: row.quoted_premium ? String(row.quoted_premium) : undefined,
          notes: row.notes ? String(row.notes) : undefined,
        };
        return accumulator;
      }, {});

      const tradeDeals = (dealsResult.data ?? []).reduce<TradeDealsMap>((accumulator, row) => {
        accumulator[String(row.id)] = {
          id: String(row.id),
          requestId: String(row.request_id),
          responseId: row.response_id ? String(row.response_id) : undefined,
          responseVersion: row.response_version !== null && row.response_version !== undefined
            ? Number(row.response_version)
            : undefined,
          counterparty: String(row.counterparty),
          bookedByEmail: row.booked_by_email ? String(row.booked_by_email) : undefined,
          product: String(row.product),
          volume: String(row.volume),
          createdAt: String(row.created_at),
          status: row.status as TradeDeal["status"],
          terms: row.terms as TradeDeal["terms"],
        };
        return accumulator;
      }, {});

      return { quoteRequests, quoteResponses, tradeDeals };
    } catch {
      return await this.fallback.loadState();
    }
  }

  async upsertQuoteRequest(request: QuoteRequest) {
    try {
      const participant = getCurrentParticipant();
      const { error } = await this.client
        .from("quote_requests")
        .upsert(
          {
            id: request.id,
            chat_id: request.chatId,
            source_message_id: request.sourceMessageId,
            type: request.type,
            status: request.status,
            requested_by: request.requestedBy,
            requested_by_email: request.requestedByEmail ?? participant?.email ?? null,
            requested_from: request.requestedFrom,
            created_at: request.createdAt,
            response_deadline: request.responseDeadline ?? null,
            terms: request.terms,
          },
          { onConflict: "id" },
        );

      if (error) {
        await this.fallback.upsertQuoteRequest(request);
      }
    } catch {
      await this.fallback.upsertQuoteRequest(request);
    }
  }

  async upsertQuoteResponse(response: QuoteResponse) {
    try {
      const participant = getCurrentParticipant();
      const { error } = await this.client
        .from("quote_responses")
        .upsert(
          {
            id: response.id,
            request_id: response.requestId,
            parent_response_id: response.parentResponseId ?? null,
            version: response.version,
            responder: response.responder,
            responder_email: response.responderEmail ?? participant?.email ?? null,
            created_at: response.createdAt,
            status: response.status,
            quoted_premium: response.quotedPremium ?? null,
            notes: response.notes ?? null,
          },
          { onConflict: "id" },
        );

      if (error) {
        await this.fallback.upsertQuoteResponse(response);
      }
    } catch {
      await this.fallback.upsertQuoteResponse(response);
    }
  }

  async upsertTradeDeal(deal: TradeDeal) {
    try {
      const participant = getCurrentParticipant();
      const { error } = await this.client
        .from("trade_deals")
        .upsert(
          {
            id: deal.id,
            request_id: deal.requestId,
            response_id: deal.responseId ?? null,
            response_version: deal.responseVersion ?? null,
            counterparty: deal.counterparty,
            booked_by_email: deal.bookedByEmail ?? participant?.email ?? null,
            product: deal.product,
            volume: deal.volume,
            created_at: deal.createdAt,
            status: deal.status,
            terms: deal.terms,
          },
          { onConflict: "id" },
        );

      if (error) {
        await this.fallback.upsertTradeDeal(deal);
      }
    } catch {
      await this.fallback.upsertTradeDeal(deal);
    }
  }
}

function createQuoteWorkflowRepository() {
  const localRepository = new LocalQuoteWorkflowRepository();

  if (config.persistence.provider !== "supabase") {
    return localRepository;
  }

  if (!hasSupabaseConfig() || !getSupabaseBrowserClient()) {
    logger.warn("Supabase quote workflow selected without configuration. Local quote workflow repository will be used.");
    return localRepository;
  }

  return new SupabaseQuoteWorkflowRepository(localRepository);
}

export const quoteWorkflowRepository = createQuoteWorkflowRepository();
