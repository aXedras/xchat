import config from "@/config/environment";
import { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentParticipant, isCurrentParticipantEmail } from "@/services/chatIdentity";
import { logger } from "@/services/logger";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/services/supabase/client";
import { Message } from "@/types/chat";
import { sortMessagesChronologically } from "@/utils/messageUtils";

const LOCAL_STORAGE_KEY = "xchat.messages.v1";

type PersistedMessageMap = Record<string, Message[]>;

export interface MessageRepository {
  saveMessage(chatId: string, message: Message): Promise<void>;
  loadAllMessages(): Promise<PersistedMessageMap>;
}

function dedupeMessages(messages: Message[]) {
  const byId = new Map<string, Message>();
  messages.forEach((message) => {
    byId.set(message.id, message);
  });

  return sortMessagesChronologically(Array.from(byId.values()));
}

function withViewerPerspective(message: Message) {
  if (message.senderEmail) {
    return {
      ...message,
      isMine: isCurrentParticipantEmail(message.senderEmail),
    } satisfies Message;
  }

  return message;
}

function safeParseJson(value: string | null): PersistedMessageMap {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as PersistedMessageMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

class LocalStorageMessageRepository implements MessageRepository {
  async saveMessage(chatId: string, message: Message) {
    if (globalThis.window === undefined) {
      return;
    }

    const existing = safeParseJson(globalThis.localStorage.getItem(LOCAL_STORAGE_KEY));
    const currentMessages = existing[chatId] ?? [];

    existing[chatId] = dedupeMessages([...currentMessages, message]).map(withViewerPerspective);
    globalThis.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
  }

  async loadAllMessages() {
    if (globalThis.window === undefined) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(safeParseJson(globalThis.localStorage.getItem(LOCAL_STORAGE_KEY))).map(([chatId, messages]) => [
        chatId,
        messages.map(withViewerPerspective),
      ]),
    );
  }
}

class SupabaseMessageRepository implements MessageRepository {
  private readonly client: SupabaseClient;

  constructor(private readonly fallback: MessageRepository) {
    this.client = getSupabaseBrowserClient();
  }

  async saveMessage(chatId: string, message: Message) {
    try {
      const participant = getCurrentParticipant();
      const payload = {
        id: message.id,
        chat_id: chatId,
        content: message.content,
        sender: message.sender,
        sender_email: message.senderEmail ?? participant?.email ?? null,
        timestamp: message.timestamp,
        created_at: message.createdAt ?? new Date().toISOString(),
        status: message.status,
        is_mine: !!message.isMine,
        is_macro: !!message.isMacro,
        quote_request_id: message.quoteRequestId ?? null,
      };

      const { error } = await this.client
        .from("chat_messages")
        .upsert(payload, { onConflict: "id" });

      if (error) {
        await this.fallback.saveMessage(chatId, message);
      }
    } catch {
      await this.fallback.saveMessage(chatId, message);
    }
  }

  async loadAllMessages() {
    try {
      const { data, error } = await this.client
        .from("chat_messages")
        .select("id, chat_id, content, sender, sender_email, timestamp, created_at, status, is_mine, is_macro, quote_request_id")
        .order("created_at", { ascending: true });

      if (error || !data) {
        return await this.fallback.loadAllMessages();
      }

      const map = data.reduce<PersistedMessageMap>((accumulator, row) => {
        const chatId = String(row.chat_id);
        accumulator[chatId] ??= [];
        accumulator[chatId].push({
          id: String(row.id),
          content: String(row.content ?? ""),
          sender: String(row.sender ?? "Unknown"),
          senderEmail: row.sender_email ? String(row.sender_email) : undefined,
          timestamp: String(row.timestamp ?? ""),
          createdAt: String(row.created_at ?? ""),
          status: (row.status as Message["status"]) || "sent",
          isMine: Boolean(row.is_mine),
          isMacro: Boolean(row.is_macro),
          quoteRequestId: row.quote_request_id ? String(row.quote_request_id) : undefined,
        });
        return accumulator;
      }, {});

      Object.keys(map).forEach((chatId) => {
        map[chatId] = dedupeMessages(map[chatId]).map(withViewerPerspective);
      });

      return map;
    } catch {
      return await this.fallback.loadAllMessages();
    }
  }
}

function createMessageRepository() {
  const localRepository = new LocalStorageMessageRepository();

  if (config.persistence.provider !== "supabase") {
    return localRepository;
  }

  if (!hasSupabaseConfig() || !getSupabaseBrowserClient()) {
    logger.warn("Supabase persistence selected without configuration. Local message repository will be used.");
    return localRepository;
  }

  return new SupabaseMessageRepository(localRepository);
}

export const messageRepository = createMessageRepository();
