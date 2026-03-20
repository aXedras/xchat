import { Dispatch, SetStateAction, useEffect } from "react";
import { Chat, Message, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";
import { getCurrentParticipant } from "@/services/chatIdentity";
import { formatChatTimestamp } from "@/utils/format";
import { RealtimeEvent } from "@/services/realtimeBus";
import { chatConversationRepository } from "@/services/persistence/chatConversationRepository";
import { messageRepository } from "@/services/persistence/messageRepository";

interface UseChatSynchronizationParams {
  realtimeOriginId: string;
  activeChats: Chat[];
  archivedChats: Chat[];
  setActiveChats: Dispatch<SetStateAction<Chat[]>>;
  setMessages: Dispatch<SetStateAction<Record<string, Message[]>>>;
  addMessageBase: (
    chatId: string,
    content: string,
    isArchived: boolean,
    restoreChat?: (chatId: string) => void,
    updateChatList?: (chatId: string, content: string, timestamp: string, createdAt?: string) => void,
    messageOverrides?: Partial<Message>,
  ) => void;
  restoreChat: (chatId: string) => void;
  upsertIncomingQuoteRequest: (request: QuoteRequest) => void;
  upsertIncomingQuoteResponse: (response: QuoteResponse) => void;
  upsertIncomingTradeDeal: (deal: TradeDeal) => void;
}

export function useChatSynchronization({
  realtimeOriginId,
  activeChats,
  archivedChats,
  setActiveChats,
  setMessages,
  addMessageBase,
  restoreChat,
  upsertIncomingQuoteRequest,
  upsertIncomingQuoteResponse,
  upsertIncomingTradeDeal,
}: Readonly<UseChatSynchronizationParams>) {
  useEffect(() => {
    let isCancelled = false;

    const loadPersistedMessages = async () => {
      const persistedMessages = await messageRepository.loadAllMessages();
      if (isCancelled) {
        return;
      }

      setMessages((previous) => {
        const next = { ...previous };

        Object.entries(persistedMessages).forEach(([chatId, persisted]) => {
          const existing = next[chatId] ?? [];
          const byId = new Map<string, Message>();

          [...existing, ...persisted].forEach((message) => {
            byId.set(message.id, message);
          });

          next[chatId] = Array.from(byId.values()).sort((left, right) => {
            const leftTime = left.createdAt ?? left.timestamp;
            const rightTime = right.createdAt ?? right.timestamp;
            return leftTime.localeCompare(rightTime);
          });
        });

        return next;
      });
    };

    void loadPersistedMessages();

    return () => {
      isCancelled = true;
    };
  }, [setMessages]);

  const upsertChatListEntry = (chat: Chat) => {
    setActiveChats((prevChats) => {
      const existing = prevChats.find((entry) => entry.id === chat.id);
      if (existing) {
        return [{ ...existing, ...chat }, ...prevChats.filter((entry) => entry.id !== chat.id)];
      }

      return [chat, ...prevChats];
    });
  };

  const updateChatListEntry = (chatId: string, content: string, timestamp: string, createdAt = new Date().toISOString()) => {
    const chatList = [...activeChats, ...archivedChats];
    const chatToUpdate = chatList.find((chat) => chat.id === chatId);

    if (!chatToUpdate) {
      return;
    }

    const updatedChat = {
      ...chatToUpdate,
      lastMessage: content,
      timestamp,
      createdAt,
    };

    setActiveChats((prevChats) => prevChats.map((chat) => (chat.id === chatId ? updatedChat : chat)));
    void chatConversationRepository.updateConversationPreview(chatId, content, createdAt);
  };

  const appendWorkflowMessage = (chatId: string, requestId: string, content: string, createdAt = new Date().toISOString()) => {
    const participant = getCurrentParticipant();
    const workflowMessage: Message = {
      id: `msg-${Date.now()}`,
      content,
      sender: participant?.displayName ?? "You",
      senderEmail: participant?.email,
      timestamp: formatChatTimestamp(new Date(createdAt)),
      createdAt,
      status: "sent",
      isMine: true,
      isMacro: false,
      quoteRequestId: requestId,
    };

    addMessageBase(chatId, content, false, restoreChat, updateChatListEntry, {
      id: workflowMessage.id,
      createdAt: workflowMessage.createdAt,
      timestamp: workflowMessage.timestamp,
      status: workflowMessage.status,
      sender: workflowMessage.sender,
      isMine: workflowMessage.isMine,
      isMacro: workflowMessage.isMacro,
      quoteRequestId: workflowMessage.quoteRequestId,
    });

    void messageRepository.saveMessage(chatId, workflowMessage);
    return workflowMessage;
  };

  const addIncomingRealtimeMessage = (event: RealtimeEvent) => {
    if (event.originId === realtimeOriginId) {
      return;
    }

    if (event.type === "chat.upsert") {
      upsertChatListEntry(event.chat);
      void chatConversationRepository.upsertConversation(event.chat);
      return;
    }

    if (event.type === "quote-request.upsert") {
      upsertIncomingQuoteRequest(event.quoteRequest);
      return;
    }

    if (event.type === "quote-response.upsert") {
      upsertIncomingQuoteResponse(event.quoteResponse);
      return;
    }

    if (event.type === "trade-deal.upsert") {
      upsertIncomingTradeDeal(event.tradeDeal);
      return;
    }

    const { chatId, message } = event;
    let isDuplicate = false;

    setMessages((previous) => {
      const existing = previous[chatId] || [];
      if (existing.some((entry) => entry.id === message.id)) {
        isDuplicate = true;
        return previous;
      }

      return {
        ...previous,
        [chatId]: [...existing, message],
      };
    });

    if (isDuplicate) {
      return;
    }

    void messageRepository.saveMessage(chatId, message);
    updateChatListEntry(chatId, message.content, message.timestamp, message.createdAt);
  };

  return {
    appendWorkflowMessage,
    updateChatListEntry,
    addIncomingRealtimeMessage,
  };
}