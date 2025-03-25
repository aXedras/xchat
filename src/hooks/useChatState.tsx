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

  const deleteChat = (chatId: string) => {
    const chatToDelete = [...activeChats, ...archivedChats].find(chat => chat.id === chatId);
    
    if (!chatToDelete) return;
    
    if (activeChats.some(chat => chat.id === chatId)) {
      setActiveChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    } else {
      setArchivedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    }
    
    setMessages(prevMessages => {
      const newMessages = { ...prevMessages };
      delete newMessages[chatId];
      return newMessages;
    });
    
    if (selectedChat?.id === chatId) {
      setSelectedChat(null);
    }
    
    toast({
      title: "Chat deleted",
      description: `"${chatToDelete.name}" has been deleted.`,
    });
  };
  
  const archiveChat = (chatId: string) => {
    const chatToArchive = activeChats.find(chat => chat.id === chatId);
    
    if (!chatToArchive) return;
    
    setActiveChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    setArchivedChats(prevChats => [chatToArchive, ...prevChats]);
    
    toast({
      title: "Chat archived",
      description: `"${chatToArchive.name}" has been moved to archive.`,
    });
  };
  
  const restoreChat = (chatId: string) => {
    const chatToRestore = archivedChats.find(chat => chat.id === chatId);
    
    if (!chatToRestore) return;
    
    setArchivedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    setActiveChats(prevChats => [chatToRestore, ...prevChats]);
    
    toast({
      title: "Chat restored",
      description: `"${chatToRestore.name}" has been restored to your messages.`,
    });
  };

  const addMessage = (chatId: string, content: string) => {
    const isArchived = archivedChats.some(chat => chat.id === chatId);
    
    if (isArchived) {
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
    
    const chatList = [...activeChats, ...archivedChats];
    const chatToUpdate = chatList.find(chat => chat.id === chatId);
    
    if (chatToUpdate) {
      const updatedChat = {
        ...chatToUpdate,
        lastMessage: content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      if (isArchived) {
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
    
    const newId = `new-${Date.now()}`;
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timestamp = `${hours}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
    
    let newChat: Chat;
    
    if (chatType === 'direct') {
      const selectedUser = selectedUsers[0];
      newChat = {
        id: newId,
        name: `${selectedUser.name} - ${company.name}`,
        lastMessage: "No messages yet",
        timestamp: timestamp,
        unread: 0,
      };
    } else if (chatType === 'group') {
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
      newChat = {
        id: newId,
        name: `${company.name} Broadcast`,
        lastMessage: "No messages yet",
        timestamp: timestamp,
        unread: 0,
        isCompany: true
      };
    }
    
    setMessages(prev => ({
      ...prev,
      [newId]: []
    }));
    
    setActiveChats(prev => [newChat, ...prev]);
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
