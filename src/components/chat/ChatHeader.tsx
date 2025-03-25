
import { Chat } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Building } from "lucide-react";
import MacroHelp from "@/components/MacroHelp";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { getInitials } from "@/utils/format";

interface ChatHeaderProps {
  chat: Chat;
}

const ChatHeader = ({ chat }: ChatHeaderProps) => {
  const formatChatName = () => {
    if (chat.isGroup || chat.isCompany) {
      return chat.name;
    }
    
    // Extract name and company for individual chats
    const parts = chat.name.split(' - ');
    if (parts.length === 2) {
      return (
        <>
          <span className="font-medium">{parts[0]}</span>
          <span className="text-muted-foreground"> • {parts[1]}</span>
        </>
      );
    }
    
    return chat.name;
  };

  const getChatIcon = () => {
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
  const extractChatDetails = () => {
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
  
  const chatDetails = extractChatDetails();

  return (
    <div className="h-16 border-b border-border flex items-center px-4 justify-between">
      <div className="flex items-center gap-3">
        {getChatIcon()}
        <div>
          <h2 className="font-semibold flex items-center gap-1">
            {chat.isGroup ? (
              chat.name
            ) : chatDetails ? (
              <>
                <span>{chatDetails.company}</span>
              </>
            ) : (
              formatChatName()
            )}
          </h2>
          
          {chat.isGroup && chat.members && (
            chat.members.length > 3 ? (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <p className="text-xs text-muted-foreground cursor-pointer">
                    {chat.members.slice(0, 3).join(", ")}
                    {` +${chat.members.length - 3} more`}
                  </p>
                </HoverCardTrigger>
                <HoverCardContent className="w-64 text-sm p-2">
                  <h4 className="font-medium mb-1">Group Participants:</h4>
                  <div className="max-h-48 overflow-y-auto">
                    <ul className="space-y-1">
                      {chat.members.map((member, index) => (
                        <li key={index} className="text-xs py-1 px-2 rounded hover:bg-accent">
                          {member}
                        </li>
                      ))}
                    </ul>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <p className="text-xs text-muted-foreground">
                {chat.members.join(", ")}
              </p>
            )
          )}
          
          {/* Show individual name for company chats */}
          {!chat.isGroup && chatDetails && (
            <p className="text-xs text-muted-foreground">
              {chatDetails.person}
            </p>
          )}
        </div>
      </div>
      
      <MacroHelp />
    </div>
  );
};

export default ChatHeader;
