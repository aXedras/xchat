
import { useState } from "react";
import { Chat } from "../types/chat";
import { initialChats } from "../data/mockChats";
import { useToast } from "./use-toast";

export function useChatLists() {
  const [activeChats, setActiveChats] = useState<Chat[]>(initialChats);
  const [archivedChats, setArchivedChats] = useState<Chat[]>([]);
  const { toast } = useToast();
  
  const deleteChat = (chatId: string) => {
    const chatToDelete = [...activeChats, ...archivedChats].find(chat => chat.id === chatId);
    
    if (!chatToDelete) return;
    
    if (activeChats.some(chat => chat.id === chatId)) {
      setActiveChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    } else {
      setArchivedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    }
    
    toast({
      title: "Chat deleted",
      description: `"${chatToDelete.name}" has been deleted.`,
    });
    
    return chatToDelete;
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

  return {
    activeChats,
    setActiveChats,
    archivedChats,
    setArchivedChats,
    deleteChat,
    archiveChat,
    restoreChat,
  };
}
