
import { useState } from "react";
import { Chat } from "../types/chat";
import { initialChats } from "../data/mockChats";
import { useToast } from "./use-toast";

export function useActiveChats() {
  const [activeChats, setActiveChats] = useState<Chat[]>(initialChats);
  const { toast } = useToast();
  
  const deleteActiveChat = (chatId: string) => {
    const chatToDelete = activeChats.find(chat => chat.id === chatId);
    
    if (!chatToDelete) return null;
    
    setActiveChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    
    toast({
      title: "Chat deleted",
      description: `"${chatToDelete.name}" has been deleted.`,
    });
    
    return chatToDelete;
  };
  
  return {
    activeChats,
    setActiveChats,
    deleteActiveChat,
  };
}
