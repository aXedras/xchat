
import { useState } from "react";
import { Chat, Message } from "../types/chat";
import { initialChats, initialMessages } from "../data/mockChats";
import { useToast } from "./use-toast";

export function useChatState() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [activeChats, setActiveChats] = useState<Chat[]>(initialChats);
  const [archivedChats, setArchivedChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>(initialMessages);
  const { toast } = useToast();
  
  const handleNewChat = () => {
    setShowNewChat(true);
  };
  
  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
  };

  // Delete a chat
  const deleteChat = (chatId: string) => {
    // Find the chat to be deleted
    const chatToDelete = [...activeChats, ...archivedChats].find(chat => chat.id === chatId);
    
    if (!chatToDelete) return;
    
    // Remove the chat from active or archived chats
    if (activeChats.some(chat => chat.id === chatId)) {
      setActiveChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    } else {
      setArchivedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    }
    
    // Remove the chat messages
    setMessages(prevMessages => {
      const newMessages = { ...prevMessages };
      delete newMessages[chatId];
      return newMessages;
    });
    
    // If the deleted chat was selected, set selectedChat to null
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
    
    // Show success toast
    toast({
      title: "Chat deleted",
      description: `"${chatToDelete.name}" has been deleted.`,
    });
  };
  
  // Archive a chat
  const archiveChat = (chatId: string) => {
    // Find the chat to be archived
    const chatToArchive = activeChats.find(chat => chat.id === chatId);
    
    if (!chatToArchive) return;
    
    // Move the chat to archived chats
    setActiveChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    setArchivedChats(prevChats => [chatToArchive, ...prevChats]);
    
    // Show success toast
    toast({
      title: "Chat archived",
      description: `"${chatToArchive.name}" has been moved to archive.`,
    });
  };
  
  // Restore a chat from archive
  const restoreChat = (chatId: string) => {
    // Find the chat to be restored
    const chatToRestore = archivedChats.find(chat => chat.id === chatId);
    
    if (!chatToRestore) return;
    
    // Move the chat back to active chats
    setArchivedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    setActiveChats(prevChats => [chatToRestore, ...prevChats]);
    
    // Show success toast
    toast({
      title: "Chat restored",
      description: `"${chatToRestore.name}" has been restored to your messages.`,
    });
  };

  // Function to add a new message to a chat (to simulate receiving a message in an archived chat)
  const addMessage = (chatId: string, content: string) => {
    // Check if the chat is in archived list
    const isArchived = archivedChats.some(chat => chat.id === chatId);
    
    if (isArchived) {
      // If chat is archived, move it back to active
      const chatToRestore = archivedChats.find(chat => chat.id === chatId);
      if (chatToRestore) {
        setArchivedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
        setActiveChats(prevChats => [chatToRestore, ...prevChats]);
        
        toast({
          title: "Chat restored",
          description: `"${chatToRestore.name}" has been automatically restored due to new activity.`,
        });
      }
    }
    
    // Add the new message
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content: content,
      sender: "You",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "sent",
      isMine: true
    };
    
    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMessage]
    }));
    
    // Update the last message preview
    const chatList = [...activeChats, ...archivedChats];
    const chatToUpdate = chatList.find(chat => chat.id === chatId);
    
    if (chatToUpdate) {
      const updatedChat = {
        ...chatToUpdate,
        lastMessage: content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      // Update the chat in the appropriate list
      if (isArchived) {
        // Already moved to active chats above
      } else {
        setActiveChats(prevChats => 
          prevChats.map(chat => chat.id === chatId ? updatedChat : chat)
        );
      }
    }
  };

  const createNewChat = (chatData: {
    chatType: 'direct' | 'group' | 'broadcast';
    company: any;
    selectedUsers: any[];
    groupName?: string;
  }) => {
    const { chatType, company, selectedUsers, groupName } = chatData;
    
    // Generate a unique ID for the new chat
    const newId = `new-${Date.now()}`;
    
    // Format current timestamp
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timestamp = `${hours}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
    
    let newChat: Chat;
    
    if (chatType === 'direct') {
      // Direct message with a single user
      const selectedUser = selectedUsers[0];
      newChat = {
        id: newId,
        name: `${selectedUser.name} - ${company.name}`,
        lastMessage: "No messages yet",
        timestamp: timestamp,
        unread: 0,
      };
    } else if (chatType === 'group') {
      // Group chat with multiple users
      newChat = {
        id: newId,
        name: groupName || `${company.name} Group`,
        lastMessage: "No messages yet",
        timestamp: timestamp,
        unread: 0,
        isGroup: true,
        members: ["You", ...selectedUsers.map(user => user.name)]
      };
    } else {
      // Broadcast to entire company
      newChat = {
        id: newId,
        name: `${company.name} Broadcast`,
        lastMessage: "No messages yet",
        timestamp: timestamp,
        unread: 0,
        isCompany: true
      };
    }
    
    // Initialize empty messages array for the new chat
    setMessages(prev => ({
      ...prev,
      [newId]: []
    }));
    
    // Add new chat to the list and set it as selected
    setChats(prev => [newChat, ...prev]);
    setSelectedChat(newChat);
    setShowNewChat(false);
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
    deleteChat,
    archiveChat,
    restoreChat,
    addMessage,
  };
}
