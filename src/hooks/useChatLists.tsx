import { Chat } from "../types/chat";
import { useActiveChats } from "./useActiveChats";

export function useChatLists() {
  const { activeChats, setActiveChats, hydrate } = useActiveChats();

  return {
    activeChats,
    setActiveChats,
    archivedChats: [] as Chat[],
    refreshChats: hydrate,
  };
}
