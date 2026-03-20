
import { useState, useCallback, useEffect } from "react";
import { Message } from "../types/chat";
import { initialMessages } from "../data/mockChats";
import { authService } from "@/services/authService";
import { getCurrentParticipant } from "@/services/chatIdentity";
import { isAskMacro } from "@/utils/askMacro";
import { formatChatTimestamp } from "@/utils/format";

export function useMessages() {
  const [messages, setMessages] = useState<Record<string, Message[]>>(initialMessages);
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  
  const addMessage = (
    chatId: string,
    content: string,
    isArchived: boolean,
    restoreChat?: (chatId: string) => void,
    updateChatList?: (chatId: string, content: string, timestamp: string) => void,
    messageOverrides?: Partial<Message>,
  ) => {
    if (isArchived && restoreChat) {
      restoreChat(chatId);
    }
    
    const now = new Date();
    const timestamp = formatChatTimestamp(now);
    const participant = getCurrentParticipant();
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content: content,
      sender: participant?.displayName ?? "You",
      senderEmail: participant?.email,
      timestamp: timestamp,
      createdAt: now.toISOString(),
      status: "sent" as const,
      isMine: true,
      isMacro: isAskMacro(content),
      ...messageOverrides,
    };
    
    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMessage]
    }));
    
    if (updateChatList) {
      updateChatList(chatId, content, timestamp);
    }
    
    // Simulate message delivery and read status
    simulateMessageStatus(chatId, newMessage.id);
  };
  
  const simulateMessageStatus = (chatId: string, messageId: string) => {
    // Simulate message delivered after 1 second
    setTimeout(() => {
      setMessages(prev => ({
        ...prev,
        [chatId]: prev[chatId].map(msg => 
          msg.id === messageId ? { ...msg, status: "delivered" as const } : msg
        )
      }));
      
      // Simulate message read after 3 more seconds
      setTimeout(() => {
        setMessages(prev => ({
          ...prev,
          [chatId]: prev[chatId].map(msg => 
            msg.id === messageId ? { ...msg, status: "read" as const } : msg
          )
        }));
      }, 3000);
    }, 1000);
  };
  
  const setTypingIndicator = useCallback((chatId: string, isTyping: boolean) => {
    setTypingStatus(prev => ({
      ...prev,
      [chatId]: isTyping
    }));
    
    // Auto-clear typing indicator after 5 seconds
    if (isTyping) {
      setTimeout(() => {
        setTypingStatus(prev => ({
          ...prev,
          [chatId]: false
        }));
      }, 5000);
    }
  }, []);
  
  // Generate random typing indicators for demo purposes
  useEffect(() => {
    if (authService.getAppIdentity()?.mode !== "demo") {
      return;
    }

    const interval = setInterval(() => {
      const keys = Object.keys(messages);
      if (keys.length > 0) {
        const randomChatId = keys[Math.floor(Math.random() * keys.length)];
        
        // 30% chance of showing typing indicator
        if (Math.random() > 0.7) {
          setTypingIndicator(randomChatId, true);
        }
      }
    }, 15000); // Every 15 seconds
    
    return () => clearInterval(interval);
  }, [messages, setTypingIndicator]);

  return {
    messages,
    setMessages,
    addMessage,
    typingStatus,
    setTypingIndicator
  };
}
