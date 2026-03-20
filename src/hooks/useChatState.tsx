
import { useMemo } from "react";
import { useChat } from "./useChat";
import { useChatLists } from "./useChatLists";
import { useMessages } from "./useMessages";
import { useChatCreation } from "./useChatCreation";
import { useQuoteRequests } from "./useQuoteRequests";
import { realtimeBus } from "@/services/realtimeBus";
import { useChatSynchronization } from "./useChatSynchronization";
import { useOutgoingMessage } from "./useOutgoingMessage";
import { useQuoteWorkflowActions } from "./useQuoteWorkflowActions";

export function useChatState() {
  const realtimeOriginId = useMemo(() => `origin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);
  const { 
    selectedChat, 
    setSelectedChat, 
    showNewChat, 
    setShowNewChat, 
    handleNewChat, 
    handleChatSelect 
  } = useChat();
  
  const { 
    activeChats, 
    setActiveChats, 
    archivedChats, 
    setArchivedChats, 
    deleteChat, 
    archiveChat, 
    restoreChat 
  } = useChatLists();
  
  const { 
    messages, 
    setMessages, 
    addMessage: addMessageBase,
    typingStatus,
    setTypingIndicator
  } = useMessages();

  const {
    quoteRequests,
    quoteResponses,
    tradeDeals,
    quoteRequestsByChat,
    quoteResponsesByRequest,
    tradeDealsByRequest,
    createOutgoingQuoteRequest,
    addQuoteResponse,
    updateQuoteResponse,
    addTradeDeal,
    upsertIncomingQuoteRequest,
    upsertIncomingQuoteResponse,
    upsertIncomingTradeDeal,
  } = useQuoteRequests();
  
  const { 
    createNewChat 
  } = useChatCreation(setActiveChats, setSelectedChat, setShowNewChat, setMessages);
  const { appendWorkflowMessage, updateChatListEntry, addIncomingRealtimeMessage } = useChatSynchronization({
    realtimeOriginId,
    activeChats,
    archivedChats,
    setActiveChats,
    setMessages,
    addMessageBase,
    restoreChat,
    upsertIncomingQuoteRequest,
    upsertIncomingQuoteResponse,
    upsertIncomingTradeDeal,
  });

  const { addMessage } = useOutgoingMessage({
    realtimeOriginId,
    activeChats,
    archivedChats,
    selectedChat,
    setSelectedChat,
    setMessages,
    setTypingIndicator,
    restoreChat,
    addMessageBase,
    updateChatListEntry,
    createOutgoingQuoteRequest,
  });

  const {
    respondToQuoteRequest,
    counterQuoteResponse,
    rejectQuoteResponse,
    convertQuoteResponseToDeal,
  } = useQuoteWorkflowActions({
    realtimeOriginId,
    quoteRequests,
    quoteResponses,
    addQuoteResponse,
    updateQuoteResponse,
    addTradeDeal,
    appendWorkflowMessage,
  });

  const createSharedChat = async (chatData: Parameters<typeof createNewChat>[0]) => {
    const chat = await createNewChat(chatData);
    if (!chat) {
      return;
    }

    realtimeBus.publish({
      originId: realtimeOriginId,
      type: "chat.upsert",
      chatId: chat.id,
      chat,
    });
  };

  // Handle chat deletion with update to selected chat
  const handleDeleteChat = (chatId: string) => {
    const deletedChat = deleteChat(chatId);
    
    if (deletedChat && selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
    
    // Also remove message history
    setMessages(prevMessages => {
      const newMessages = { ...prevMessages };
      delete newMessages[chatId];
      return newMessages;
    });
  };
  
  // Get the typing status for the selected chat
  const isSelectedChatTyping = selectedChat ? typingStatus[selectedChat.id] : false;

  return {
    realtimeOriginId,
    addIncomingRealtimeMessage,
    selectedChat,
    setSelectedChat,
    showNewChat,
    setShowNewChat,
    chats: activeChats,
    archivedChats,
    messages,
    setMessages,
    quoteRequests,
    quoteRequestsByChat,
    quoteResponses,
    quoteResponsesByRequest,
    tradeDeals,
    tradeDealsByRequest,
    handleNewChat,
    handleChatSelect,
    createNewChat: createSharedChat,
    deleteChat: handleDeleteChat,
    archiveChat,
    restoreChat,
    addMessage,
    addQuoteResponse,
    addTradeDeal,
    respondToQuoteRequest,
    counterQuoteResponse,
    rejectQuoteResponse,
    convertQuoteResponseToDeal,
    isTyping: isSelectedChatTyping,
    setTypingIndicator
  };
}
