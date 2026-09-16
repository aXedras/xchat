import { useCallback, useEffect, useRef, useState } from "react";
import { Chat, ParticipantRecord, QuoteInvitationRecord, QuoteResponseRecord, SendMessagesResult } from "@/types/chat";
import { useChatLists } from "./useChatLists";
import { useMessages } from "./useMessages";
import { useChatSynchronization } from "./useChatSynchronization";
import { useOutgoingMessage, SendInput } from "./useOutgoingMessage";
import { messageRepository, MessagingError } from "@/services/persistence/messageRepository";
import { realtimeBus } from "@/services/realtimeBus";
import { useToast } from "./use-toast";
import i18n from "@/i18n";

export function useChatState() {
  const { activeChats, refreshChats, deleteChat: deleteChatPersisted } = useChatLists();
  const { messages, setMessages } = useMessages();

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [quoteInvitations, setQuoteInvitations] = useState<QuoteInvitationRecord[]>([]);
  const [quoteResponses, setQuoteResponses] = useState<Record<string, QuoteResponseRecord[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const pendingClientIds = useRef<Map<string, string>>(new Map());
  const { toast } = useToast();

  const refreshParticipants = useCallback(async () => {
    setParticipants(await messageRepository.listParticipants());
  }, []);

  const refreshQuoteInvitations = useCallback(async () => {
    setQuoteInvitations(await messageRepository.listQuoteInvitations());
  }, []);

  const { loadMessages } = useChatSynchronization({ setMessages, refreshChats, refreshQuoteInvitations });
  const { send } = useOutgoingMessage({ setMessages, refreshChats });

  useEffect(() => {
    void refreshParticipants().catch(() => setError(i18n.t("errors.loadParticipants")));
    void refreshQuoteInvitations().catch(() => setError(i18n.t("errors.loadInvitations")));
  }, [refreshParticipants, refreshQuoteInvitations]);

  const handleChatSelect = useCallback(
    (chat: Chat) => {
      setSelectedChat(chat);
      void loadMessages(chat.id).catch(() => setError(i18n.t("errors.loadMessages")));
    },
    [loadMessages],
  );

  const clearChat = useCallback((chatId: string) => {
    setSelectedChat((current) => (current?.id === chatId ? null : current));
    setMessages((previous) => {
      const next = { ...previous };
      delete next[chatId];
      return next;
    });
    setQuoteInvitations((previous) =>
      previous.filter((invitation) => invitation.conversationId !== chatId),
    );
  }, []);

  const deleteChat = useCallback(
    async (chatId: string) => {
      const chatBeingDeleted = activeChats.find((chat) => chat.id === chatId);
      try {
        await deleteChatPersisted(chatId);
        clearChat(chatId);
        toast({
          title: i18n.t("chat.deleteSuccessTitle"),
          description: i18n.t("chat.deleteSuccessDescription", {
            name: chatBeingDeleted?.name ?? "",
          }),
        });
      } catch (e) {
        const code = e instanceof MessagingError ? e.code : "unknown";
        const descriptionKey =
          code === "conversation_has_activity"
            ? "errors.deleteChatHasActivity"
            : "errors.deleteChat";
        toast({
          variant: "destructive",
          title: i18n.t("errors.deleteChatTitle"),
          description: i18n.t(descriptionKey),
        });
      }
    },
    [activeChats, deleteChatPersisted, clearChat, toast],
  );

  useEffect(() => {
    const unsubscribe = realtimeBus.onConversationDeleted((event) => {
      clearChat(event.conversationId);
      void refreshChats();
    });
    return unsubscribe;
  }, [clearChat, refreshChats]);

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
        setError(e instanceof Error ? e.message : i18n.t("errors.send"));
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
      setError(e instanceof Error ? e.message : i18n.t("errors.loadResponses"));
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
        setError(e instanceof Error ? e.message : i18n.t("errors.performAction"));
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
    deleteChat,
  };
}
