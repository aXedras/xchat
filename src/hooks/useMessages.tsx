import { useState, useCallback } from "react";
import { Message } from "../types/chat";

export function useMessages() {
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

  const setTypingIndicator = useCallback((_chatId: string, _isTyping: boolean) => {
    // Presence/typing is out of MVP scope; no-op placeholder.
  }, []);

  return {
    messages,
    setMessages,
    typingStatus: {} as Record<string, boolean>,
    setTypingIndicator,
  };
}
