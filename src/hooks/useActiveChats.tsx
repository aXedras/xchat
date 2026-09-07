import { useCallback, useEffect, useState } from "react";
import { Chat } from "../types/chat";
import { chatConversationRepository } from "@/services/persistence/chatConversationRepository";

export function useActiveChats() {
  const [activeChats, setActiveChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(async () => {
    try {
      const conversations = await chatConversationRepository.listConversations();
      setActiveChats(conversations);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load conversations");
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return {
    activeChats,
    setActiveChats,
    hydrate,
    error,
  };
}
