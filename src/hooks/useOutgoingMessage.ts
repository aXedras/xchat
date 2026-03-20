import { Dispatch, SetStateAction } from "react";
import { Chat, Message, QuoteRequest } from "@/types/chat";
import { authService } from "@/services/authService";
import { getCurrentParticipant } from "@/services/chatIdentity";
import { formatChatTimestamp } from "@/utils/format";
import { realtimeBus } from "@/services/realtimeBus";
import { messageRepository } from "@/services/persistence/messageRepository";

interface UseOutgoingMessageParams {
  realtimeOriginId: string;
  activeChats: Chat[];
  archivedChats: Chat[];
  selectedChat: Chat | null;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
  setMessages: Dispatch<SetStateAction<Record<string, Message[]>>>;
  setTypingIndicator: (chatId: string, isTyping: boolean) => void;
  restoreChat: (chatId: string) => void;
  addMessageBase: (
    chatId: string,
    content: string,
    isArchived: boolean,
    restoreChat?: (chatId: string) => void,
    updateChatList?: (chatId: string, content: string, timestamp: string, createdAt?: string) => void,
    messageOverrides?: Partial<Message>,
  ) => void;
  updateChatListEntry: (chatId: string, content: string, timestamp: string, createdAt?: string) => void;
  createOutgoingQuoteRequest: (input: {
    chatId: string;
    counterpartyName: string;
    companyName?: string;
    message: Message;
  }) => QuoteRequest | undefined;
}

function scheduleDemoReply(
  chatId: string,
  activeChats: Chat[],
  archivedChats: Chat[],
  setMessages: Dispatch<SetStateAction<Record<string, Message[]>>>,
  setTypingIndicator: (chatId: string, isTyping: boolean) => void,
  updateChatListEntry: (chatId: string, content: string, timestamp: string, createdAt?: string) => void,
) {
  setTimeout(() => {
    setTypingIndicator(chatId, true);

    if (Math.random() <= 0.5) {
      return;
    }

    setTimeout(() => {
      const simulatedResponses = [
        "I'll look into this and get back to you",
        "Thanks for the information",
        "Let me check the details with our team",
        "I'll prepare the documents you requested",
      ];

      const response = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];
      const now = new Date();
      const timestamp = formatChatTimestamp(now);
      const chatName = [...activeChats, ...archivedChats].find((chat) => chat.id === chatId)?.name || "";
      const senderName = chatName.split(" - ")[0];

      const newMessage: Message = {
        id: `sim-${Date.now()}`,
        content: response,
        sender: senderName,
        timestamp,
        createdAt: now.toISOString(),
        status: "delivered",
        isMine: false,
      };

      setMessages((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), newMessage],
      }));

      messageRepository.saveMessage(chatId, newMessage);
      updateChatListEntry(chatId, response, timestamp);
      setTypingIndicator(chatId, false);
    }, 4000);
  }, 2000);
}

export function useOutgoingMessage({
  realtimeOriginId,
  activeChats,
  archivedChats,
  selectedChat,
  setSelectedChat,
  setMessages,
  setTypingIndicator,
  restoreChat,
  addMessageBase,
  updateChatListEntry,
  createOutgoingQuoteRequest,
}: Readonly<UseOutgoingMessageParams>) {
  const addMessage = (chatId: string, content: string) => {
    setTypingIndicator(chatId, false);

    const isArchived = archivedChats.some((chat) => chat.id === chatId);
    const messageId = `msg-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const participant = getCurrentParticipant();
    const chatName = [...activeChats, ...archivedChats].find((chat) => chat.id === chatId)?.name || "";
    const counterpartyName = chatName.split(" - ")[0] || chatName || "Counterparty";
    const companyName = chatName.split(" - ")[1] || undefined;

    const quoteRequest = createOutgoingQuoteRequest({
      chatId,
      counterpartyName,
      companyName,
      message: {
        id: messageId,
        content,
        sender: participant?.displayName ?? "You",
        senderEmail: participant?.email,
        timestamp: "",
        createdAt,
        status: "sent",
        isMine: true,
      },
    });

    addMessageBase(chatId, content, isArchived, restoreChat, updateChatListEntry, {
      id: messageId,
      createdAt,
      quoteRequestId: quoteRequest?.id,
    });

    const message: Message = {
      id: messageId,
      content,
      sender: participant?.displayName ?? "You",
      senderEmail: participant?.email,
      timestamp: formatChatTimestamp(new Date(createdAt)),
      createdAt,
      status: "sent",
      isMine: true,
      quoteRequestId: quoteRequest?.id,
    };

    realtimeBus.publish({
      originId: realtimeOriginId,
      type: "message.upsert",
      chatId,
      message,
    });

    messageRepository.saveMessage(chatId, message);

    if (quoteRequest) {
      realtimeBus.publish({
        originId: realtimeOriginId,
        type: "quote-request.upsert",
        chatId,
        quoteRequest,
      });
    }

    if (selectedChat?.id === chatId && !activeChats.some((chat) => chat.id === chatId) && !archivedChats.some((chat) => chat.id === chatId)) {
      const updatedChat = [...activeChats, ...archivedChats].find((chat) => chat.id === chatId);
      if (updatedChat) {
        setSelectedChat(updatedChat);
      }
    }

    if (authService.getAppIdentity()?.mode !== "demo") {
      return;
    }

    scheduleDemoReply(chatId, activeChats, archivedChats, setMessages, setTypingIndicator, updateChatListEntry);
  };

  return { addMessage };
}