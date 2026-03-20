
import { Chat, Company, Message, User } from "../types/chat";
import { chatConversationRepository } from "@/services/persistence/chatConversationRepository";
import { formatChatTimestamp } from "@/utils/format";

type ChatCreationType = "direct" | "group" | "broadcast";

interface ChatCreationData {
  chatType: ChatCreationType;
  company: Company;
  participantEmails: string[];
  selectedUsers: User[];
  groupName?: string;
}

export function useChatCreation(
  setActiveChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  setSelectedChat: React.Dispatch<React.SetStateAction<Chat | null>>,
  setShowNewChat: React.Dispatch<React.SetStateAction<boolean>>,
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>,
) {
  
  const createNewChat = async (chatData: ChatCreationData) => {
    const { chatType, company, participantEmails, selectedUsers, groupName } = chatData;

    const fallbackParticipantEmails = selectedUsers.map((user) => `${user.id}@local.xchat`);
    const effectiveParticipantEmails = participantEmails.length > 0 ? participantEmails : fallbackParticipantEmails;
    let conversationName = `${selectedUsers[0]?.name ?? company.name} - ${company.name}`;
    if (chatType === "group") {
      conversationName = groupName || `${company.name} Group`;
    }

    if (chatType === "broadcast") {
      conversationName = `${company.name} Broadcast`;
    }

    const createdConversation = await chatConversationRepository.createConversation({
      companyName: company.name,
      name: conversationName,
      participantEmails: effectiveParticipantEmails,
      type: chatType,
    });

    const newChat: Chat = {
      ...createdConversation,
      name: conversationName,
      timestamp: formatChatTimestamp(new Date(createdConversation.createdAt ?? new Date().toISOString())),
      unread: 0,
      isGroup: chatType === "group",
      isCompany: chatType === "broadcast",
      members: chatType === "group"
        ? selectedUsers.map((user) => user.name)
        : createdConversation.members,
    };

    setMessages((prev) => ({
      ...prev,
      [newChat.id]: prev[newChat.id] ?? [],
    }));

    setActiveChats((prev) => [newChat, ...prev.filter((chat) => chat.id !== newChat.id)]);
    setSelectedChat(newChat);
    setShowNewChat(false);

    return newChat;
  };

  return {
    createNewChat,
  };
}
