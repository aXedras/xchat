import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { logger } from "@/services/logger";

export interface MessageCreatedEvent {
  messageId: string;
  conversationId: string;
  messageType: "standard" | "rfq";
}

export interface ConversationDeletedEvent {
  conversationId: string;
  deletedByUserId: string;
}

type MessageCreatedListener = (event: MessageCreatedEvent) => void;
type ConversationDeletedListener = (event: ConversationDeletedEvent) => void;

class MessagingRealtime {
  private channel: ReturnType<
    NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]
  > | null = null;
  private currentUserId: string | null = null;
  private readonly messageCreatedListeners = new Set<MessageCreatedListener>();
  private readonly conversationDeletedListeners =
    new Set<ConversationDeletedListener>();

  connect(userId: string) {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return () => {};
    }

    if (this.channel && this.currentUserId === userId) {
      return () => {};
    }

    if (this.channel) {
      void client.removeChannel(this.channel);
    }

    this.currentUserId = userId;
    this.channel = client.channel(`user:${userId}`, { config: { private: true } });

    this.channel.on(
      "broadcast",
      { event: "message.created" },
      (payload: unknown) => {
        const raw = payload as { payload?: MessageCreatedEvent };
        const event = raw?.payload;
        if (event && typeof event.messageId === "string") {
          this.messageCreatedListeners.forEach((listener) => {
            try {
              listener(event);
            } catch {
              // Listener failures must not break the realtime channel.
            }
          });
        }
      },
    );

    this.channel.on(
      "broadcast",
      { event: "conversation.deleted" },
      (payload: unknown) => {
        const raw = payload as { payload?: ConversationDeletedEvent };
        const event = raw?.payload;
        if (event && typeof event.conversationId === "string") {
          this.conversationDeletedListeners.forEach((listener) => {
            try {
              listener(event);
            } catch {
              // Listener failures must not break the realtime channel.
            }
          });
        }
      },
    );

    this.channel.subscribe((status, error) => {
      if (status !== "SUBSCRIBED" && error) {
        logger.warn("Realtime subscribe failed", { error });
      }
    });

    return () => {};
  }

  onMessageCreated(listener: MessageCreatedListener) {
    this.messageCreatedListeners.add(listener);
    return () => {
      this.messageCreatedListeners.delete(listener);
    };
  }

  onConversationDeleted(listener: ConversationDeletedListener) {
    this.conversationDeletedListeners.add(listener);
    return () => {
      this.conversationDeletedListeners.delete(listener);
    };
  }

  disconnect() {
    const client = getSupabaseBrowserClient();
    if (client && this.channel) {
      void client.removeChannel(this.channel);
    }
    this.channel = null;
    this.currentUserId = null;
  }
}

export const realtimeBus = new MessagingRealtime();
