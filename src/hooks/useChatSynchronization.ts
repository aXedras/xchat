import { Dispatch, SetStateAction, useCallback, useEffect } from "react";
import { Message } from "@/types/chat";
import { messageRepository } from "@/services/persistence/messageRepository";
import { mapMessageRecordToMessage } from "@/services/persistence/chatConversationRepository";
import { realtimeBus } from "@/services/realtimeBus";
import { getCurrentParticipant } from "@/services/chatIdentity";
import { mergeMessages } from "@/utils/messageUtils";

interface UseChatSynchronizationParams {
  setMessages: Dispatch<SetStateAction<Record<string, Message[]>>>;
  refreshChats: () => Promise<void>;
  refreshQuoteInvitations: () => Promise<void>;
}

export function useChatSynchronization({
  setMessages,
  refreshChats,
  refreshQuoteInvitations,
}: Readonly<UseChatSynchronizationParams>) {
  const loadMessages = useCallback(
    async (conversationId: string) => {
      const page = await messageRepository.listMessages(conversationId, null, 100);
      const mapped = page.messages.map(mapMessageRecordToMessage);
      setMessages((previous) => ({
        ...previous,
        [conversationId]: mergeMessages(previous[conversationId] ?? [], mapped),
      }));
    },
    [setMessages],
  );

  useEffect(() => {
    const participant = getCurrentParticipant();
    if (!participant?.userId) {
      return;
    }

    realtimeBus.connect(participant.userId);
    const unsubscribe = realtimeBus.onMessageCreated(async (event) => {
      try {
        const message = await messageRepository.getMessage(event.messageId);
        if (message) {
          const mapped = mapMessageRecordToMessage(message);
          setMessages((previous) => ({
            ...previous,
            [message.conversationId]: mergeMessages(previous[message.conversationId] ?? [], [mapped]),
          }));
          void refreshChats();
          if (message.type === "rfq") {
            void refreshQuoteInvitations();
          }
        }
      } catch {
        // A missed message is recovered by the next conversation load.
      }
    });

    return () => {
      unsubscribe();
      realtimeBus.disconnect();
    };
  }, [setMessages, refreshChats, refreshQuoteInvitations]);

  return { loadMessages };
}
