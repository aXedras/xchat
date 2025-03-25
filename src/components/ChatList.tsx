
import { Chat } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, Building } from "lucide-react";
import ChatContextMenu from "./ChatContextMenu";
import { getInitials } from "@/utils/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onDeleteChat?: (chatId: string) => void;
  onArchiveChat?: (chatId: string) => void;
  onRestoreChat?: (chatId: string) => void;
  isArchiveSection?: boolean;
}

const ChatList = ({ 
  chats, 
  selectedChat, 
  onSelectChat,
  onDeleteChat = () => {}, 
  onArchiveChat = () => {},
  onRestoreChat = () => {},
  isArchiveSection = false
}: ChatListProps) => {
  
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
  
  // Helper function to extract chat details (individual + company name)
  const extractChatDetails = (chat: Chat) => {
    if (chat.isGroup) return null;
    
    // For individual chats in format "Person Name - Company Name"
    const parts = chat.name.split(' - ');
    if (parts.length === 2) {
      return {
        person: parts[0],
        company: parts[1]
      };
    }
    
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-hidden">
      <TooltipProvider>
        {chats.map((chat) => {
          const chatDetails = extractChatDetails(chat);
          
          return (
            <ChatContextMenu 
              key={chat.id}
              chat={chat}
              onDelete={onDeleteChat}
              onArchive={isArchiveSection ? undefined : onArchiveChat}
              onRestore={isArchiveSection ? onRestoreChat : undefined}
              isArchived={isArchiveSection}
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
                      {chat.isGroup ? (
                        chat.name
                      ) : chatDetails ? (
                        chatDetails.company
                      ) : (
                        chat.name
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {chat.timestamp}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1">
                    {chatDetails ? (
                      <p className="text-sm text-muted-foreground truncate pr-2">
                        {chatDetails.person}: {chat.lastMessage}
                      </p>
                    ) : chat.isGroup && chat.members && chat.members.length > 3 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm text-muted-foreground truncate pr-2">
                            {chat.lastMessage}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-2">
                          <p className="text-xs font-medium mb-1">Participants:</p>
                          <p className="text-xs">{chat.members.join(", ")}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <p className="text-sm text-muted-foreground truncate pr-2">
                        {chat.lastMessage}
                      </p>
                    )}
                    
                    {chat.unread > 0 && (
                      <Badge variant="default" className="rounded-full h-5 min-w-5 flex items-center justify-center">
                        {chat.unread}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </ChatContextMenu>
          );
        })}
      </TooltipProvider>
    </div>
  );
};

export default ChatList;
