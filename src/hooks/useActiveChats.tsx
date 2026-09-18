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

  const deleteChat = useCallback(async (chatId: string): Promise<void> => {
    let deleteError: unknown = null;
    try {
      await chatConversationRepository.deleteConversation(chatId);
    } catch (e) {
      deleteError = e;
    }

    try {
      // Always re-fetch after attempting a delete: this is the single source
      // of ground truth used below, independent of React state timing.
      const conversations = await chatConversationRepository.listConversations();
      setActiveChats(conversations);

      const stillExists = conversations.some((chat) => chat.id === chatId);
      if (deleteError && stillExists) {
        // Confirmed real failure: the chat is still present after a fresh
        // refetch.
        throw deleteError;
      }
      // Either the delete succeeded, or it failed ambiguously (e.g. transport
      // error) but the chat is confirmed gone after refetch — treat both as
      // success.
      return;
    } catch (e) {
      if (deleteError) {
        // The reconciliation refetch itself failed and the delete also
        // errored: we cannot confirm the chat is gone, so surface the error.
        throw deleteError;
      }
      // The delete RPC succeeded but the reconciliation refetch failed.
      // Remove the chat locally so the UI stays consistent without surfacing
      // a misleading error.
      setActiveChats((previous) => previous.filter((chat) => chat.id !== chatId));
    }
  }, []);

  return {
    activeChats,
    setActiveChats,
    hydrate,
    deleteChat,
    error,
  };
}
