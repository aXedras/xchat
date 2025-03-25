
import { useChat } from "./useChat";
import { useChatLists } from "./useChatLists";
import { useMessages } from "./useMessages";
import { useChatCreation } from "./useChatCreation";

export function useChatState() {
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
    addMessage: addMessageBase 
  } = useMessages();
  
  const { 
    createNewChat 
  } = useChatCreation(setActiveChats, setSelectedChat, setShowNewChat, setMessages);
  
  // Custom addMessage that integrates with the chat lists
  const addMessage = (chatId: string, content: string) => {
    const isArchived = archivedChats.some(chat => chat.id === chatId);
    
    const updateChatList = (chatId: string, content: string, timestamp: string) => {
      const chatList = [...activeChats, ...archivedChats];
      const chatToUpdate = chatList.find(chat => chat.id === chatId);
      
      if (chatToUpdate) {
        const updatedChat = {
          ...chatToUpdate,
          lastMessage: content,
          timestamp: timestamp,
        };
        
        setActiveChats(prevChats => 
          prevChats.map(chat => chat.id === chatId ? updatedChat : chat)
        );
      }
    };
    
    addMessageBase(chatId, content, isArchived, restoreChat, updateChatList);
    
    // If this is a selected chat that was deleted, update it
    if (selectedChat?.id === chatId && !activeChats.find(c => c.id === chatId) && !archivedChats.find(c => c.id === chatId)) {
      const updatedChat = [...activeChats, ...archivedChats].find(c => c.id === chatId);
      if (updatedChat) {
        setSelectedChat(updatedChat);
      }
    }
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

  return {
    selectedChat,
    setSelectedChat,
    showNewChat,
    setShowNewChat,
    chats: activeChats,
    archivedChats,
    messages,
    setMessages,
    handleNewChat,
    handleChatSelect,
    createNewChat,
    deleteChat: handleDeleteChat,
    archiveChat,
    restoreChat,
    addMessage,
  };
}
