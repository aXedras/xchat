
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
    addMessage: addMessageBase,
    typingStatus,
    setTypingIndicator
  } = useMessages();
  
  const { 
    createNewChat 
  } = useChatCreation(setActiveChats, setSelectedChat, setShowNewChat, setMessages);
  
  // Custom addMessage that integrates with the chat lists
  const addMessage = (chatId: string, content: string) => {
    // Show typing indicator before sending a message
    setTypingIndicator(chatId, false);
    
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
    
    // Simulate typing indicator from other user after sending a message
    setTimeout(() => {
      setTypingIndicator(chatId, true);
      
      // Simulate a response after typing (for demo purposes)
      if (Math.random() > 0.5) {
        setTimeout(() => {
          const simulatedResponses = [
            "I'll look into this and get back to you",
            "Thanks for the information",
            "Let me check the details with our team",
            "I'll prepare the documents you requested"
          ];
          
          const response = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];
          
          const now = new Date();
          const hours = now.getHours();
          const minutes = now.getMinutes().toString().padStart(2, '0');
          const timestamp = `${hours}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
          
          const chatName = [...activeChats, ...archivedChats].find(c => c.id === chatId)?.name || "";
          const senderName = chatName.split(" - ")[0];
          
          const newMessage = {
            id: `sim-${Date.now()}`,
            content: response,
            sender: senderName,
            timestamp,
            status: "delivered",
            isMine: false
          };
          
          setMessages(prev => ({
            ...prev,
            [chatId]: [...(prev[chatId] || []), newMessage]
          }));
          
          updateChatList(chatId, response, timestamp);
          setTypingIndicator(chatId, false);
        }, 4000); // Simulate reply after 4 seconds of typing
      }
    }, 2000);
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
    isTyping: isSelectedChatTyping,
    setTypingIndicator
  };
}
