
import { Chat } from "../types/chat";
import { useActiveChats } from "./useActiveChats";
import { useArchivedChats } from "./useArchivedChats";
import { useToast } from "./use-toast";

export function useChatLists() {
  const { activeChats, setActiveChats, deleteActiveChat } = useActiveChats();
  const { archivedChats, setArchivedChats, deleteArchivedChat } = useArchivedChats();
  const { toast } = useToast();
  
  const deleteChat = (chatId: string) => {
    let deletedChat = deleteActiveChat(chatId);
    
    if (!deletedChat) {
      deletedChat = deleteArchivedChat(chatId);
    }
    
    return deletedChat;
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
