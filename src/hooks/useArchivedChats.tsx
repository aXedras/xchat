
import { useState } from "react";
import { Chat } from "../types/chat";
import { useToast } from "./use-toast";

export function useArchivedChats() {
  const [archivedChats, setArchivedChats] = useState<Chat[]>([]);
  const { toast } = useToast();
  
  const deleteArchivedChat = (chatId: string) => {
    const chatToDelete = archivedChats.find(chat => chat.id === chatId);
    
    if (!chatToDelete) return null;
    
    setArchivedChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    
    toast({
      title: "Chat deleted",
      description: `"${chatToDelete.name}" has been deleted.`,
    });
    
    return chatToDelete;
  };
  
  return {
    archivedChats,
    setArchivedChats,
    deleteArchivedChat,
  };
}
