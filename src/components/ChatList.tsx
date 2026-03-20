
import { Chat } from "@/types/chat";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ChatContextMenu from "./ChatContextMenu";
import { ChatAvatar, getDirectChatDetails } from "@/components/chat/chatPresentation";
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
  return (
    <div className="flex-1 overflow-y-auto scroll-hidden">
      <TooltipProvider>
        {chats.map((chat) => {
          const chatDetails = getDirectChatDetails(chat);
          
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
                <ChatAvatar chat={chat} />
                
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
