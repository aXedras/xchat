import { Dispatch, SetStateAction, useCallback, useRef } from "react";
import { Message, MessageType } from "@/types/chat";
import { messageRepository, MessagingError } from "@/services/persistence/messageRepository";
import { mapMessageRecordToMessage } from "@/services/persistence/chatConversationRepository";
import { mergeMessages } from "@/utils/messageUtils";

export interface SendInput {
  dispatchId?: string;
  recipientIds: string[];
  retryRecipientIds?: string[];
  content: string;
  messageType?: MessageType;
  rfqTerms?: Record<string, unknown>;
}

export interface UseOutgoingMessageParams {
  setMessages: Dispatch<SetStateAction<Record<string, Message[]>>>;
  refreshChats: () => Promise<void>;
}

function sameRecipientSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function samePayload(a: SendInput, b: SendInput): boolean {
  return (
    (a.messageType ?? "standard") === (b.messageType ?? "standard") &&
    a.content === b.content &&
    sameRecipientSet(a.recipientIds, b.recipientIds) &&
    JSON.stringify(a.rfqTerms ?? null) === JSON.stringify(b.rfqTerms ?? null)
  );
}

export function useOutgoingMessage({ setMessages, refreshChats }: Readonly<UseOutgoingMessageParams>) {
  const pendingDispatchRef = useRef<{ input: SendInput & { dispatchId: string } } | null>(null);

  const send = useCallback(
    async (input: SendInput) => {
      const isExplicitRetry = typeof input.dispatchId === "string";

      let dispatchId: string;
      if (isExplicitRetry) {
        dispatchId = input.dispatchId;
      } else {
        const pending = pendingDispatchRef.current;
        if (pending && samePayload(pending.input, input)) {
          dispatchId = pending.input.dispatchId;
        } else {
          dispatchId = crypto.randomUUID();
        }
        pendingDispatchRef.current = { input: { ...input, dispatchId } };
      }

      try {
        const result = await messageRepository.sendMessages({
          dispatchId,
          messageType: input.messageType ?? "standard",
          content: input.content,
          recipientIds: input.recipientIds,
          rfqTerms: input.rfqTerms,
          retryRecipientIds: input.retryRecipientIds,
        });

        if (!isExplicitRetry) {
          pendingDispatchRef.current = null;
        }

        result.dispatch.messages.forEach(({ message }) => {
          const mapped = mapMessageRecordToMessage(message);
          setMessages((previous) => ({
            ...previous,
            [message.conversationId]: mergeMessages(previous[message.conversationId] ?? [], [mapped]),
          }));
        });

        void refreshChats();
        return result;
      } catch (error) {
        if (!isExplicitRetry && !(error instanceof MessagingError && error.retryable)) {
          pendingDispatchRef.current = null;
        }
        throw error;
      }
    },
    [setMessages, refreshChats],
  );

  return { send };
}
