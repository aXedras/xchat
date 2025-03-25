
import { useState } from "react";
import { Chat, Message, Company, User } from "../types/chat";
import { initialChats, initialMessages } from "../data/mockChats";
import { useToast } from "./use-toast";

export function useChatState() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [messages, setMessages] = useState<Record<string, Message[]>>(initialMessages);
  const { toast } = useToast();
  
  const handleNewChat = () => {
    setShowNewChat(true);
  };
  
  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
  };

  // New function to delete a chat
  const deleteChat = (chatId: string) => {
    // Find the chat to be deleted
    const chatToDelete = chats.find(chat => chat.id === chatId);
    
    if (!chatToDelete) return;
    
    // Remove the chat from the chats list
    setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    
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
  
  // New function to archive a chat (for future implementation)
  const archiveChat = (chatId: string) => {
    // Find the chat to be archived
    const chatToArchive = chats.find(chat => chat.id === chatId);
    
    if (!chatToArchive) return;
    
    // In a real application, we would mark the chat as archived here
    // For now, we'll just show a toast notification
    toast({
      title: "Chat archived",
      description: `"${chatToArchive.name}" has been archived.`,
    });
  };

  const createNewChat = (chatData: {
    chatType: 'direct' | 'group' | 'broadcast';
    company: Company;
    selectedUsers: User[];
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
    chats,
    setChats,
    messages,
    setMessages,
    handleNewChat,
    handleChatSelect,
    createNewChat,
    deleteChat,
    archiveChat
  };
}
