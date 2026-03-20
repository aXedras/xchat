import { SupabaseClient } from "@supabase/supabase-js";
import config from "@/config/environment";
import { initialChats } from "@/data/mockChats";
import { getCurrentParticipant, normalizeParticipantEmails } from "@/services/chatIdentity";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/services/supabase/client";
import { Chat } from "@/types/chat";
import { formatChatTimestamp } from "@/utils/format";

const STORAGE_KEY = "xchat.conversations.v1";

export interface CreateConversationInput {
  companyName?: string;
  name: string;
  participantEmails: string[];
  type: "direct" | "group" | "broadcast";
}

export interface ChatConversationRepository {
  createConversation(input: CreateConversationInput): Promise<Chat>;
  loadConversations(): Promise<Chat[]>;
  updateConversationPreview(chatId: string, content: string, createdAt: string): Promise<void>;
  upsertConversation(chat: Chat): Promise<void>;
}

function sortChats(chats: Chat[]) {
  return [...chats].sort((left, right) => {
    const leftTime = left.createdAt ?? left.timestamp;
    const rightTime = right.createdAt ?? right.timestamp;
    return rightTime.localeCompare(leftTime);
  });
}

function toStoredChats(value: string | null) {
  if (!value) {
    return initialChats;
  }

  try {
    const parsed = JSON.parse(value) as Chat[];
    return Array.isArray(parsed) ? parsed : initialChats;
  } catch {
    return initialChats;
  }
}

function buildChatSummary(chat: Partial<Chat> & Pick<Chat, "id" | "name">) {
  return {
    id: chat.id,
    name: chat.name,
    type: chat.type ?? "direct",
    companyName: chat.companyName,
    lastMessage: chat.lastMessage ?? "No messages yet",
    timestamp: chat.timestamp ?? formatChatTimestamp(new Date()),
    unread: chat.unread ?? 0,
    createdAt: chat.createdAt ?? new Date().toISOString(),
    isGroup: chat.type === "group",
    isCompany: chat.type === "broadcast",
    members: chat.members ?? [],
    participantEmails: chat.participantEmails ?? [],
  } satisfies Chat;
}

class LocalChatConversationRepository implements ChatConversationRepository {
  private readChats() {
    if (typeof window === "undefined") {
      return initialChats;
    }

    return toStoredChats(window.localStorage.getItem(STORAGE_KEY));
  }

  private writeChats(chats: Chat[]) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortChats(chats)));
  }

  async createConversation(input: CreateConversationInput) {
    const participant = getCurrentParticipant();
    const createdAt = new Date().toISOString();
    const participantEmails = normalizeParticipantEmails([
      participant?.email ?? "demo@axedras.com",
      ...input.participantEmails,
    ]);
    const chat = buildChatSummary({
      id: `chat-${Date.now()}`,
      name: input.name,
      type: input.type,
      companyName: input.companyName,
      createdAt,
      timestamp: formatChatTimestamp(new Date(createdAt)),
      members: participantEmails,
      participantEmails,
    });

    this.writeChats([chat, ...this.readChats().filter((entry) => entry.id !== chat.id)]);
    return chat;
  }

  async loadConversations() {
    return sortChats(this.readChats());
  }

  async updateConversationPreview(chatId: string, content: string, createdAt: string) {
    const chats = this.readChats().map((chat) => {
      if (chat.id !== chatId) {
        return chat;
      }

      return {
        ...chat,
        lastMessage: content,
        timestamp: formatChatTimestamp(new Date(createdAt)),
        createdAt,
      } satisfies Chat;
    });

    this.writeChats(chats);
  }

  async upsertConversation(chat: Chat) {
    this.writeChats([chat, ...this.readChats().filter((entry) => entry.id !== chat.id)]);
  }
}

class SupabaseChatConversationRepository implements ChatConversationRepository {
  private readonly client: SupabaseClient;

  constructor(private readonly fallback: ChatConversationRepository) {
    this.client = getSupabaseBrowserClient() as SupabaseClient;
  }

  async createConversation(input: CreateConversationInput) {
    const participant = getCurrentParticipant();
    if (!participant) {
      throw new Error("You must be signed in before creating a shared conversation.");
    }

    const createdAt = new Date().toISOString();
    const conversationId = `chat-${Date.now()}`;
    const participantEmails = normalizeParticipantEmails([participant.email, ...input.participantEmails]);
    const chat = buildChatSummary({
      id: conversationId,
      name: input.name,
      type: input.type,
      companyName: input.companyName,
      createdAt,
      timestamp: formatChatTimestamp(new Date(createdAt)),
      members: participantEmails,
      participantEmails,
    });

    const { error: conversationError } = await this.client.from("chat_conversations").upsert({
      id: conversationId,
      name: input.name,
      type: input.type,
      company_name: input.companyName ?? null,
      created_by_email: participant.email,
      created_at: createdAt,
      updated_at: createdAt,
      last_message: chat.lastMessage,
      last_message_at: createdAt,
    }, { onConflict: "id" });

    if (conversationError) {
      throw new Error(conversationError.message);
    }

    const { error: membersError } = await this.client.from("chat_conversation_members").upsert(
      participantEmails.map((email) => ({
        conversation_id: conversationId,
        member_email: email,
        display_name: email === participant.email ? participant.displayName : null,
        member_role: email === participant.email ? "owner" : "member",
      })),
      { onConflict: "conversation_id,member_email" },
    );

    if (membersError) {
      throw new Error(membersError.message);
    }

    return chat;
  }

  async loadConversations() {
    const participant = getCurrentParticipant();
    if (!participant) {
      return [];
    }

    const { data, error } = await this.client
      .from("chat_conversations")
      .select("id, name, type, company_name, created_at, updated_at, last_message, last_message_at, chat_conversation_members!inner(member_email)")
      .eq("chat_conversation_members.member_email", participant.email)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error || !data) {
      return await this.fallback.loadConversations();
    }

    const conversationIds = data.map((row) => String(row.id));
    const { data: membersData } = conversationIds.length === 0
      ? { data: [] }
      : await this.client
          .from("chat_conversation_members")
          .select("conversation_id, member_email")
          .in("conversation_id", conversationIds);

    const memberEmailsByChat = (membersData ?? []).reduce<Record<string, string[]>>((accumulator, row) => {
      const chatId = String(row.conversation_id);
      accumulator[chatId] ??= [];
      accumulator[chatId].push(String(row.member_email));
      return accumulator;
    }, {});

    return sortChats(data.map((row) => buildChatSummary({
      id: String(row.id),
      name: String(row.name),
      type: row.type as Chat["type"],
      companyName: row.company_name ? String(row.company_name) : undefined,
      createdAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
      timestamp: formatChatTimestamp(new Date(String(row.last_message_at ?? row.created_at ?? new Date().toISOString()))),
      lastMessage: String(row.last_message ?? "No messages yet"),
      members: memberEmailsByChat[String(row.id)] ?? [],
      participantEmails: memberEmailsByChat[String(row.id)] ?? [],
    })));
  }

  async updateConversationPreview(chatId: string, content: string, createdAt: string) {
    const { error } = await this.client.from("chat_conversations").update({
      last_message: content,
      last_message_at: createdAt,
      updated_at: createdAt,
    }).eq("id", chatId);

    if (error) {
      await this.fallback.updateConversationPreview(chatId, content, createdAt);
    }
  }

  async upsertConversation(chat: Chat) {
    const { error } = await this.client.from("chat_conversations").upsert({
      id: chat.id,
      name: chat.name,
      type: chat.type ?? "direct",
      company_name: chat.companyName ?? null,
      created_by_email: getCurrentParticipant()?.email ?? null,
      created_at: chat.createdAt ?? new Date().toISOString(),
      updated_at: chat.createdAt ?? new Date().toISOString(),
      last_message: chat.lastMessage,
      last_message_at: chat.createdAt ?? new Date().toISOString(),
    }, { onConflict: "id" });

    if (error) {
      await this.fallback.upsertConversation(chat);
    }
  }
}

function createChatConversationRepository() {
  const fallback = new LocalChatConversationRepository();
  if (config.persistence.provider !== "supabase") {
    return fallback;
  }

  if (!hasSupabaseConfig() || !getSupabaseBrowserClient()) {
    return fallback;
  }

  return new SupabaseChatConversationRepository(fallback);
}

export const chatConversationRepository = createChatConversationRepository();