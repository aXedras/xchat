import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { logger } from "@/services/logger";

export interface MessageCreatedEvent {
  messageId: string;
  conversationId: string;
  messageType: "standard" | "rfq";
}

type MessageCreatedListener = (event: MessageCreatedEvent) => void;

class MessagingRealtime {
  private channel: ReturnType<
    NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]
  > | null = null;
  private currentUserId: string | null = null;
  private readonly listeners = new Set<MessageCreatedListener>();

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
    this.channel.on("broadcast", { event: "message.created" }, (payload: unknown) => {
      const raw = payload as { payload?: MessageCreatedEvent };
      const event = raw?.payload;
      if (event && typeof event.messageId === "string") {
        this.listeners.forEach((listener) => {
          try {
            listener(event);
          } catch {
            // Listener failures must not break the realtime channel.
          }
        });
      }
    });
    this.channel.subscribe((status, error) => {
      if (status !== "SUBSCRIBED" && error) {
        logger.warn("Realtime subscribe failed", { error });
      }
    });

    return () => {};
  }

  onMessageCreated(listener: MessageCreatedListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
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
