
import { Chat } from "../types/chat";

export function useChatCreation(setActiveChats: React.Dispatch<React.SetStateAction<Chat[]>>, setSelectedChat: React.Dispatch<React.SetStateAction<Chat | null>>, setShowNewChat: React.Dispatch<React.SetStateAction<boolean>>, setMessages: React.Dispatch<React.SetStateAction<Record<string, any>>>) {
  
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
    createNewChat,
  };
}
