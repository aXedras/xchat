
import { useEffect, useState } from "react";
import { Chat } from "../types/chat";
import { initialChats } from "../data/mockChats";
import { chatConversationRepository } from "@/services/persistence/chatConversationRepository";
import { useToast } from "./use-toast";

export function useActiveChats() {
  const [activeChats, setActiveChats] = useState<Chat[]>(initialChats);
  const { toast } = useToast();

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      const conversations = await chatConversationRepository.loadConversations();
      if (!isCancelled && conversations.length > 0) {
        setActiveChats(conversations);
      }
    };

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, []);
  
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
