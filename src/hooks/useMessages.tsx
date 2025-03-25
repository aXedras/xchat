
import { useState } from "react";
import { Chat, Message } from "../types/chat";
import { initialMessages } from "../data/mockChats";

export function useMessages() {
  const [messages, setMessages] = useState<Record<string, Message[]>>(initialMessages);
  
  const addMessage = (chatId: string, content: string, isArchived: boolean, restoreChat?: (chatId: string) => void, updateChatList?: (chatId: string, content: string, timestamp: string) => void) => {
    if (isArchived && restoreChat) {
      restoreChat(chatId);
    }
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timestamp = `${hours}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content: content,
      sender: "You",
      timestamp: timestamp,
      status: "sent",
      isMine: true
    };
    
    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMessage]
    }));
    
    if (updateChatList) {
      updateChatList(chatId, content, timestamp);
    }
  };

  return {
    messages,
    setMessages,
    addMessage,
  };
}
