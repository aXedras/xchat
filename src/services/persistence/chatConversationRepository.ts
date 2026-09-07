import { messageRepository } from "@/services/persistence/messageRepository";
import { getCurrentParticipant } from "@/services/chatIdentity";
import { Chat, ConversationRecord, Message, MessageRecord } from "@/types/chat";
import { formatChatTimestamp } from "@/utils/format";

export interface ConversationSummary {
  id: string;
  counterpartyUserId: string;
  counterpartyDisplayName: string;
  counterpartyOrganization: string | null;
  lastMessageAt: string | null;
  lastMessage: string | null;
  createdAt: string;
}

function toConversationSummary(value: unknown): ConversationSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.counterpartyUserId !== "string") {
    return null;
  }
  return {
    id: record.id,
    counterpartyUserId: record.counterpartyUserId,
    counterpartyDisplayName:
      typeof record.counterpartyDisplayName === "string" ? record.counterpartyDisplayName : "Counterparty",
    counterpartyOrganization:
      typeof record.counterpartyOrganization === "string" ? record.counterpartyOrganization : null,
    lastMessageAt: typeof record.lastMessageAt === "string" ? record.lastMessageAt : null,
    lastMessage: typeof record.lastMessage === "string" ? record.lastMessage : null,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
  };
}

export function mapConversationToChat(summary: ConversationSummary): Chat {
  return {
    id: summary.id,
    name: summary.counterpartyDisplayName,
    counterpartyUserId: summary.counterpartyUserId,
    companyName: summary.counterpartyOrganization ?? undefined,
    lastMessage: summary.lastMessage ?? "No messages yet",
    timestamp: summary.lastMessageAt
      ? formatChatTimestamp(new Date(summary.lastMessageAt))
      : formatChatTimestamp(new Date(summary.createdAt)),
    unread: 0,
    createdAt: summary.lastMessageAt ?? summary.createdAt,
  };
}

export function mapMessageRecordToMessage(record: MessageRecord): Message {
  const participant = getCurrentParticipant();
  const isMine = !!participant?.userId && record.senderUserId === participant.userId;
  return {
    id: record.id,
    content: record.content,
    sender: isMine ? participant?.displayName ?? "You" : "Counterparty",
    senderEmail: undefined,
    timestamp: formatChatTimestamp(new Date(record.createdAt)),
    createdAt: record.createdAt,
    status: "delivered",
    isMine,
    isMacro: false,
    quoteRequestId: record.quoteRequestId ?? undefined,
  };
}

export const chatConversationRepository = {
  async listConversations(): Promise<Chat[]> {
    const data = await messageRepository.listConversations();
    return data
      .map((value) => toConversationSummary(value))
      .filter((summary): summary is ConversationSummary => summary !== null)
      .map(mapConversationToChat);
  },
};

export type { ConversationRecord };
