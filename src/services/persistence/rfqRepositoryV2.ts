import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { MessagingError, toMessagingError } from "./errors";
import { logger } from "@/services/logger";
import {
  QuoteRequestValidationResult,
  RecipientInvitationProjection,
  RequesterRfqProjection,
  RfqDispatchRecipient,
  RfqDispatchResult,
  TransactionTypeAvailability,
} from "@/types/rfq";
import { RfqTermsV2 } from "@/schemas";

const CURRENT_SCHEMA_VERSION = 1;

function requireClient(): SupabaseClient {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new MessagingError("unauthenticated");
  }
  return client;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asTerms(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  // Unknown future schema versions fail closed at the repository boundary.
  const schemaVersion =
    typeof record.schemaVersion === "number" ? record.schemaVersion : 0;
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new MessagingError("unknown_schema_version");
  }
  return record;
}

function parseRequesterProjection(value: unknown): RequesterRfqProjection {
  const record = asRecord(value);
  const invitations = Array.isArray(record.invitations)
    ? record.invitations.map((entry) => {
        const e = asRecord(entry);
        return {
          invitationId: String(e.invitationId),
          recipientUserId: String(e.recipientUserId),
          recipientOrganizationId:
            typeof e.recipientOrganizationId === "string"
              ? e.recipientOrganizationId
              : null,
          status: String(e.status),
          deliveredAt: typeof e.deliveredAt === "string" ? e.deliveredAt : null,
          firstViewedAt:
            typeof e.firstViewedAt === "string" ? e.firstViewedAt : null,
          respondedAt: typeof e.respondedAt === "string" ? e.respondedAt : null,
          closedAt: typeof e.closedAt === "string" ? e.closedAt : null,
        };
      })
    : [];
  return {
    id: String(record.id),
    publicReference:
      typeof record.publicReference === "string" ? record.publicReference : null,
    transactionType:
      typeof record.transactionType === "string" ? record.transactionType : null,
    schemaVersion:
      typeof record.schemaVersion === "number" ? record.schemaVersion : 0,
    status: String(record.status),
    effectiveStatus: String(record.effectiveStatus),
    responseDeadline:
      typeof record.responseDeadline === "string" ? record.responseDeadline : null,
    terms: asTerms(record.terms),
    createdAt: String(record.createdAt),
    closedAt: typeof record.closedAt === "string" ? record.closedAt : null,
    closeReason:
      typeof record.closeReason === "string" ? record.closeReason : null,
    invitations,
  };
}

function parseRecipientProjection(value: unknown): RecipientInvitationProjection {
  const record = asRecord(value);
  return {
    invitationId: String(record.invitationId),
    requestId: String(record.requestId),
    publicReference:
      typeof record.publicReference === "string" ? record.publicReference : null,
    transactionType:
      typeof record.transactionType === "string" ? record.transactionType : null,
    status: String(record.status),
    effectiveStatus: String(record.effectiveStatus),
    responseDeadline:
      typeof record.responseDeadline === "string" ? record.responseDeadline : null,
    terms: asTerms(record.terms),
    createdAt: String(record.createdAt),
    deliveredAt: typeof record.deliveredAt === "string" ? record.deliveredAt : null,
    firstViewedAt:
      typeof record.firstViewedAt === "string" ? record.firstViewedAt : null,
    respondedAt: typeof record.respondedAt === "string" ? record.respondedAt : null,
  };
}

export interface CreateAndDispatchInput {
  clientOperationId: string;
  transactionType: string;
  terms: RfqTermsV2;
  recipientIds: string[];
  message?: string;
}

function parseDispatchResult(value: unknown): RfqDispatchResult {
  const record = asRecord(value);
  const dispatch = asRecord(record.dispatch);
  const recipients: RfqDispatchRecipient[] = Array.isArray(dispatch.recipients)
    ? dispatch.recipients.map((entry) => {
        const r = asRecord(entry);
        return {
          requestedRecipientUserId: String(r.requestedRecipientUserId),
          recipientUserId:
            typeof r.recipientUserId === "string" ? r.recipientUserId : null,
          status: (r.status === "accepted" ? "accepted" : "rejected") as
            | "accepted"
            | "rejected",
          errorCode: typeof r.errorCode === "string" ? r.errorCode : null,
          messageId: typeof r.messageId === "string" ? r.messageId : null,
        };
      })
    : [];
  return {
    ok: record.ok === true,
    quoteRequestId: String(record.quoteRequestId),
    dispatch: {
      id: String(dispatch.id),
      status:
        dispatch.status === "partial"
          ? "partial"
          : dispatch.status === "failed"
            ? "failed"
            : "completed",
      messages: Array.isArray(dispatch.messages)
        ? dispatch.messages.map((entry) => {
            const m = asRecord(entry);
            return {
              recipientUserId: String(m.recipientUserId),
              message: asRecord(m.message),
            };
          })
        : [],
      recipients,
    },
  };
}

async function invoke<T>(
  rpcName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const client = requireClient();
  try {
    const { data, error } = await client.rpc(rpcName, args);
    if (error) {
      throw error;
    }
    return data as T;
  } catch (error) {
    const normalized = toMessagingError(error);
    if (normalized.correlationId) {
      logger.error("repository rpc failed", {
        rpc: rpcName,
        code: normalized.code,
        correlationId: normalized.correlationId,
      });
    }
    throw normalized;
  }
}

export const rfqRepositoryV2 = {
  async listAvailableTransactionTypes(): Promise<TransactionTypeAvailability[]> {
    const data = await invoke<unknown>("list_available_transaction_types", {});
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((entry) => {
      const record = asRecord(entry);
      return {
        code: String(record.code),
        available: record.available === true,
      };
    });
  },

  async validateQuoteRequest(
    terms: Record<string, unknown>,
    transactionType: string,
  ): Promise<QuoteRequestValidationResult> {
    const data = await invoke<unknown>("validate_quote_request", {
      p_terms: terms,
      p_transaction_type: transactionType,
    });
    const record = asRecord(data);
    return {
      ok: record.ok === true,
      transactionType: String(record.transactionType),
    };
  },

  async createAndDispatch(input: CreateAndDispatchInput): Promise<RfqDispatchResult> {
    const data = await invoke<unknown>("create_and_dispatch_quote_request_v2", {
      request: {
        clientOperationId: input.clientOperationId,
        transactionType: input.transactionType,
        terms: input.terms,
        recipientIds: input.recipientIds,
        message: input.message ?? "",
      },
    });
    return parseDispatchResult(data);
  },

  async getRequesterProjection(requestId: string): Promise<RequesterRfqProjection> {
    const data = await invoke<unknown>("get_quote_request_projection", {
      p_request_id: requestId,
    });
    return parseRequesterProjection(data);
  },

  async getRecipientProjection(
    invitationId: string,
  ): Promise<RecipientInvitationProjection> {
    const data = await invoke<unknown>("get_quote_invitation_projection", {
      p_invitation_id: invitationId,
    });
    return parseRecipientProjection(data);
  },

  async markInvitationViewed(invitationId: string): Promise<void> {
    await invoke<unknown>("mark_quote_invitation_viewed", {
      p_invitation_id: invitationId,
    });
  },

  async cancelQuoteRequest(requestId: string): Promise<void> {
    await invoke<unknown>("cancel_quote_request", {
      p_request_id: requestId,
    });
  },

  async submitQuoteResponseV2(input: {
    invitationId: string;
    clientResponseId: string;
    responseTerms: Record<string, unknown>;
  }): Promise<unknown> {
    return invoke("submit_quote_response_v2", {
      request: {
        invitationId: input.invitationId,
        clientResponseId: input.clientResponseId,
        responseTerms: input.responseTerms,
      },
    });
  },

  async counterQuoteResponseV2(input: {
    parentResponseId: string;
    clientResponseId: string;
    responseTerms: Record<string, unknown>;
  }): Promise<unknown> {
    return invoke("counter_quote_response_v2", {
      request: {
        parentResponseId: input.parentResponseId,
        clientResponseId: input.clientResponseId,
        responseTerms: input.responseTerms,
      },
    });
  },

  async withdrawQuoteResponse(responseId: string): Promise<void> {
    await invoke("withdraw_quote_response", { p_response_id: responseId });
  },

  async declineQuoteInvitation(invitationId: string): Promise<void> {
    await invoke("decline_quote_invitation", { p_invitation_id: invitationId });
  },

  async rejectQuoteResponseV2(input: {
    responseId: string;
    clientActionId: string;
  }): Promise<unknown> {
    return invoke("reject_quote_response_v2", {
      request: { responseId: input.responseId, clientActionId: input.clientActionId },
    });
  },

  async bookQuoteResponseV2(input: {
    responseId: string;
    clientActionId: string;
  }): Promise<unknown> {
    return invoke("book_quote_response_v2", {
      request: { responseId: input.responseId, clientActionId: input.clientActionId },
    });
  },

  async getDealProjection(dealId: string): Promise<Record<string, unknown>> {
    return invoke("get_deal_projection", { p_deal_id: dealId });
  },
};
