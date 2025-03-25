
import { Chat } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, Building } from "lucide-react";
import ChatContextMenu from "./ChatContextMenu";

interface ChatListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onDeleteChat?: (chatId: string) => void;
  onArchiveChat?: (chatId: string) => void;
}

const ChatList = ({ 
  chats, 
  selectedChat, 
  onSelectChat,
  onDeleteChat = () => {}, 
  onArchiveChat = () => {}
}: ChatListProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const getChatIcon = (chat: Chat) => {
    if (chat.avatar) {
      return (
        <Avatar>
          <AvatarImage src={chat.avatar} alt={chat.name} />
          <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
        </Avatar>
      );
    } else if (chat.isGroup) {
      return (
        <Avatar className="bg-purple-100">
          <Users className="h-5 w-5 text-purple-500" />
          <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
        </Avatar>
      );
    } else if (chat.isCompany) {
      return (
        <Avatar className="bg-blue-100">
          <Building className="h-5 w-5 text-blue-500" />
          <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
        </Avatar>
      );
    } else {
      return (
        <Avatar>
          <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
        </Avatar>
      );
    }
  };
  
  const formatChatName = (chat: Chat) => {
    if (chat.isGroup || chat.isCompany) {
      return chat.name;
    }
    
    // Extract name and company for individual chats
    const parts = chat.name.split(' - ');
    if (parts.length === 2) {
      return (
        <>
          <span className="font-medium">{parts[0]}</span>
          <span className="text-muted-foreground text-xs"> • {parts[1]}</span>
        </>
      );
    }
    
    return chat.name;
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-hidden">
      {chats.map((chat) => (
        <ChatContextMenu 
          key={chat.id}
          chat={chat}
          onDelete={onDeleteChat}
          onArchive={onArchiveChat}
        >
          <div
            className={cn(
              "flex items-center gap-3 p-3 hover:bg-accent/40 transition-colors cursor-pointer",
              selectedChat?.id === chat.id && "bg-accent"
            )}
            onClick={() => onSelectChat(chat)}
          >
            {getChatIcon(chat)}
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline gap-2">
                <div className="font-medium truncate">
                  {formatChatName(chat)}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {chat.timestamp}
                </span>
              </div>
              
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-muted-foreground truncate pr-2">
                  {chat.lastMessage}
                </p>
                {chat.unread > 0 && (
                  <Badge variant="default" className="rounded-full h-5 min-w-5 flex items-center justify-center">
                    {chat.unread}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </ChatContextMenu>
      ))}
    </div>
  );
};

export default ChatList;
