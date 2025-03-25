
import { Chat } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Building } from "lucide-react";
import MacroHelp from "@/components/MacroHelp";

interface ChatHeaderProps {
  chat: Chat;
}

const ChatHeader = ({ chat }: ChatHeaderProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

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

  return (
    <div className="h-16 border-b border-border flex items-center px-4 justify-between">
      <div className="flex items-center gap-3">
        {getChatIcon()}
        <div>
          <h2 className="font-semibold flex items-center gap-1">
            {formatChatName()}
          </h2>
          {chat.isGroup && chat.members && (
            <p className="text-xs text-muted-foreground">
              {chat.members.slice(0, 3).join(", ")}
              {chat.members.length > 3 && ` +${chat.members.length - 3} more`}
            </p>
          )}
        </div>
      </div>
      
      <MacroHelp />
    </div>
  );
};

export default ChatHeader;
