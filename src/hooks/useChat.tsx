
import { useState } from "react";
import { Chat } from "../types/chat";

export function useChat() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  
  const handleNewChat = () => {
    setShowNewChat(true);
  };
  
  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
  };

  return {
    selectedChat,
    setSelectedChat,
    showNewChat,
    setShowNewChat,
    handleNewChat,
    handleChatSelect,
  };
}
