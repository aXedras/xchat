import { useCallback, useEffect, useRef, useState } from "react";
import { Chat, ParticipantRecord, QuoteInvitationRecord, QuoteResponseRecord, SendMessagesResult } from "@/types/chat";
import { useChatLists } from "./useChatLists";
import { useMessages } from "./useMessages";
import { useChatSynchronization } from "./useChatSynchronization";
import { useOutgoingMessage, SendInput } from "./useOutgoingMessage";
import { messageRepository, MessagingError } from "@/services/persistence/messageRepository";

export function useChatState() {
  const { activeChats, refreshChats } = useChatLists();
  const { messages, setMessages } = useMessages();

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [quoteInvitations, setQuoteInvitations] = useState<QuoteInvitationRecord[]>([]);
  const [quoteResponses, setQuoteResponses] = useState<Record<string, QuoteResponseRecord[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const pendingClientIds = useRef<Map<string, string>>(new Map());

  const refreshParticipants = useCallback(async () => {
    setParticipants(await messageRepository.listParticipants());
  }, []);

  const refreshQuoteInvitations = useCallback(async () => {
    setQuoteInvitations(await messageRepository.listQuoteInvitations());
  }, []);

  const { loadMessages } = useChatSynchronization({ setMessages, refreshChats, refreshQuoteInvitations });
  const { send } = useOutgoingMessage({ setMessages, refreshChats });

  useEffect(() => {
    void refreshParticipants().catch(() => setError("Unable to load participants"));
    void refreshQuoteInvitations().catch(() => setError("Unable to load quote invitations"));
  }, [refreshParticipants, refreshQuoteInvitations]);

  const handleChatSelect = useCallback(
    (chat: Chat) => {
      setSelectedChat(chat);
      void loadMessages(chat.id).catch(() => setError("Unable to load messages"));
    },
    [loadMessages],
  );

  const dispatchSend = useCallback(
    async (input: SendInput): Promise<SendMessagesResult | undefined> => {
      setSending(true);
      setError(null);
      try {
        const result = await send(input);
        if (input.messageType === "rfq") {
          void refreshQuoteInvitations();
        }
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to send message");
        return undefined;
      } finally {
        setSending(false);
      }
    },
    [send, refreshQuoteInvitations],
  );

  const sendDirect = useCallback(
    async (recipientUserId: string, content: string): Promise<boolean> => {
      const result = await dispatchSend({ recipientIds: [recipientUserId], content });
      return result !== undefined;
    },
    [dispatchSend],
  );

  const sendToRecipients = useCallback(
    (recipientIds: string[], content: string) =>
      dispatchSend({ recipientIds, content }),
    [dispatchSend],
  );

  const sendRfq = useCallback(
    (recipientIds: string[], content: string, rfqTerms: Record<string, unknown>) =>
      dispatchSend({ recipientIds, content, messageType: "rfq", rfqTerms }),
    [dispatchSend],
  );

  const retryDispatch = useCallback(
    (
      original: SendInput & { dispatchId: string },
      retryRecipientIds: string[],
    ) =>
      dispatchSend({
        dispatchId: original.dispatchId,
        recipientIds: original.recipientIds,
        retryRecipientIds,
        content: original.content,
        messageType: original.messageType,
        rfqTerms: original.rfqTerms,
      }),
    [dispatchSend],
  );

  const loadQuoteResponses = useCallback(async (invitationId: string) => {
    try {
      const responses = await messageRepository.listQuoteResponses(invitationId);
      setQuoteResponses((previous) => ({ ...previous, [invitationId]: responses }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load responses");
    }
  }, []);

  const reloadInvitationState = useCallback(async (invitationId: string) => {
    await loadQuoteResponses(invitationId);
    await refreshQuoteInvitations();
    await refreshChats();
  }, [loadQuoteResponses, refreshQuoteInvitations, refreshChats]);

  const runQuoteAction = useCallback(
    async (
      invitationId: string,
      canonical: string,
      action: (clientId: string) => Promise<unknown>,
    ): Promise<unknown> => {
      setError(null);
      const existing = pendingClientIds.current.get(canonical);
      const clientId = existing ?? crypto.randomUUID();
      pendingClientIds.current.set(canonical, clientId);
      try {
        const result = await action(clientId);
        pendingClientIds.current.delete(canonical);
        await reloadInvitationState(invitationId);
        return result;
      } catch (e) {
        if (!(e instanceof MessagingError && e.retryable)) {
          pendingClientIds.current.delete(canonical);
        }
        setError(e instanceof Error ? e.message : "Unable to perform action");
        return undefined;
      }
    },
    [reloadInvitationState],
  );

  const submitQuote = useCallback(
    (invitationId: string, quotedPremium: string, notes?: string | null) =>
      runQuoteAction(
        invitationId,
        JSON.stringify(["submit", invitationId, quotedPremium, notes ?? null]),
        (clientResponseId) =>
          messageRepository.submitQuoteResponse({
            invitationId,
            clientResponseId,
            quotedPremium,
            notes,
          }),
      ),
    [runQuoteAction],
  );

  const counterQuote = useCallback(
    (invitationId: string, parentResponseId: string, quotedPremium: string, notes?: string | null) =>
      runQuoteAction(
        invitationId,
        JSON.stringify(["counter", parentResponseId, quotedPremium, notes ?? null]),
        (clientResponseId) =>
          messageRepository.counterQuoteResponse({
            parentResponseId,
            clientResponseId,
            quotedPremium,
            notes,
          }),
      ),
    [runQuoteAction],
  );

  const rejectQuote = useCallback(
    (invitationId: string, responseId: string) =>
      runQuoteAction(
        invitationId,
        JSON.stringify(["reject", responseId]),
        (clientActionId) => messageRepository.rejectQuoteResponse({ responseId, clientActionId }),
      ),
    [runQuoteAction],
  );

  const bookQuote = useCallback(
    (invitationId: string, responseId: string) =>
      runQuoteAction(
        invitationId,
        JSON.stringify(["book", responseId]),
        (clientActionId) => messageRepository.bookQuoteResponse({ responseId, clientActionId }),
      ),
    [runQuoteAction],
  );

  return {
    activeChats,
    selectedChat,
    messages,
    participants,
    quoteInvitations,
    quoteResponses,
    error,
    sending,
    refreshChats,
    refreshParticipants,
    refreshQuoteInvitations,
    handleChatSelect,
    sendDirect,
    sendToRecipients,
    sendRfq,
    retryDispatch,
    loadQuoteResponses,
    submitQuote,
    counterQuote,
    rejectQuote,
    bookQuote,
    setSelectedChat,
  };
}
