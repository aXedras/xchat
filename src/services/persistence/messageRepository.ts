import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import {
  DispatchRecipientRecord,
  MessageDispatchRecord,
  MessageRecord,
  MessagesPage,
  MessageType,
  ParticipantRecord,
  QuoteInvitationRecord,
  QuoteRequestRecord,
  QuoteResponseRecord,
  RfqTerms,
  SendMessagesResult,
  TradeDealRecord,
} from "@/types/chat";

export class MessagingError extends Error {
  code: string;
  retryable: boolean;

  constructor(code: string, retryable = false) {
    super(code);
    this.name = "MessagingError";
    this.code = code;
    this.retryable = retryable;
  }
}

interface SendMessagesRequest {
  dispatchId: string;
  messageType: MessageType;
  content: string;
  recipientIds: string[];
  rfqTerms?: Record<string, unknown>;
  retryRecipientIds?: string[];
}

function requireClient(): SupabaseClient {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new MessagingError("unauthenticated");
  }
  return client;
}

function toMessagingError(error: unknown): MessagingError {
  if (error instanceof MessagingError) {
    return error;
  }

  const record = error as { message?: string; details?: string; code?: string };
  if (record?.details) {
    try {
      const details = JSON.parse(record.details) as { code?: string };
      if (details?.code) {
        return new MessagingError(details.code, false);
      }
    } catch {
      // fall through
    }
  }

  if (record?.code) {
    return new MessagingError(record.code, false);
  }

  // No structured server error: the outcome is ambiguous (transport/timeout).
  return new MessagingError("unknown", true);
}

export const messageRepository = {
  async sendMessages(request: SendMessagesRequest): Promise<SendMessagesResult> {
    const client = requireClient();
    try {
      const payload: Record<string, unknown> = {
        dispatchId: request.dispatchId,
        messageType: request.messageType,
        content: request.content,
        recipientIds: request.recipientIds,
      };
      if (request.messageType === "rfq" && request.rfqTerms) {
        payload.rfqTerms = request.rfqTerms;
      }
      if (request.retryRecipientIds) {
        payload.retryRecipientIds = request.retryRecipientIds;
      }

      const { data, error } = await client.rpc("send_messages", { request: payload });
      if (error) {
        throw error;
      }
      return data as SendMessagesResult;
    } catch (error) {
      throw toMessagingError(error);
    }
  },

  async listParticipants(): Promise<ParticipantRecord[]> {
    const client = requireClient();
    const { data, error } = await client.rpc("list_participants");
    if (error) {
      throw toMessagingError(error);
    }
    return Array.isArray(data) ? (data as ParticipantRecord[]) : [];
  },

  async listConversations() {
    const client = requireClient();
    const { data, error } = await client.rpc("list_conversations");
    if (error) {
      throw toMessagingError(error);
    }
    return Array.isArray(data) ? data : [];
  },

  async listMessages(
    conversationId: string,
    cursor: { createdAt: string; id: string } | null,
    limit = 100,
  ): Promise<MessagesPage> {
    const client = requireClient();
    const { data, error } = await client.rpc("list_messages", {
      p_conversation_id: conversationId,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: limit,
    });
    if (error) {
      throw toMessagingError(error);
    }
    return data as MessagesPage;
  },

  async getMessage(messageId: string): Promise<MessageRecord | null> {
    const client = requireClient();
    const { data, error } = await client.rpc("get_message", { p_message_id: messageId });
    if (error) {
      throw toMessagingError(error);
    }
    return (data as MessageRecord | null) ?? null;
  },

  async getDispatch(dispatchId: string): Promise<MessageDispatchRecord | null> {
    const client = requireClient();
    const { data, error } = await client.rpc("get_dispatch", { p_dispatch_id: dispatchId });
    if (error) {
      throw toMessagingError(error);
    }
    return (data as MessageDispatchRecord | null) ?? null;
  },

  async listQuoteInvitations(): Promise<QuoteInvitationRecord[]> {
    const client = requireClient();
    const { data, error } = await client.rpc("list_quote_invitations");
    if (error) {
      throw toMessagingError(error);
    }
    return Array.isArray(data) ? (data as QuoteInvitationRecord[]) : [];
  },

  async listQuoteResponses(invitationId: string): Promise<QuoteResponseRecord[]> {
    const client = requireClient();
    const { data, error } = await client.rpc("list_quote_responses", { p_invitation_id: invitationId });
    if (error) {
      throw toMessagingError(error);
    }
    return Array.isArray(data) ? (data as QuoteResponseRecord[]) : [];
  },

  async submitQuoteResponse(input: {
    invitationId: string;
    clientResponseId: string;
    quotedPremium: string;
    notes?: string | null;
  }) {
    const client = requireClient();
    const { data, error } = await client.rpc("submit_quote_response", {
      request: {
        invitationId: input.invitationId,
        clientResponseId: input.clientResponseId,
        quotedPremium: input.quotedPremium,
        notes: input.notes ?? null,
      },
    });
    if (error) {
      throw toMessagingError(error);
    }
    return data as { ok: boolean; response: QuoteResponseRecord; message: MessageRecord };
  },

  async counterQuoteResponse(input: {
    parentResponseId: string;
    clientResponseId: string;
    quotedPremium: string;
    notes?: string | null;
  }) {
    const client = requireClient();
    const { data, error } = await client.rpc("counter_quote_response", {
      request: {
        parentResponseId: input.parentResponseId,
        clientResponseId: input.clientResponseId,
        quotedPremium: input.quotedPremium,
        notes: input.notes ?? null,
      },
    });
    if (error) {
      throw toMessagingError(error);
    }
    return data as { ok: boolean; response: QuoteResponseRecord; message: MessageRecord };
  },

  async rejectQuoteResponse(input: { responseId: string; clientActionId: string }) {
    const client = requireClient();
    const { data, error } = await client.rpc("reject_quote_response", {
      request: { responseId: input.responseId, clientActionId: input.clientActionId },
    });
    if (error) {
      throw toMessagingError(error);
    }
    return data as { ok: boolean; response: QuoteResponseRecord; message: MessageRecord };
  },

  async bookQuoteResponse(input: { responseId: string; clientActionId: string }) {
    const client = requireClient();
    const { data, error } = await client.rpc("book_quote_response", {
      request: { responseId: input.responseId, clientActionId: input.clientActionId },
    });
    if (error) {
      throw toMessagingError(error);
    }
    return data as {
      ok: boolean;
      response: QuoteResponseRecord;
      deal: TradeDealRecord;
      message: MessageRecord;
    };
  },
};

export type { RfqTerms, QuoteRequestRecord };
