import { useRef, useEffect, useState } from "react";
import { Chat, Message } from "@/pages/Dashboard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, CheckCheck, Info, Users, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import MessageInput from "@/components/MessageInput";
import MacroHelp from "@/components/MacroHelp";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  onSendMessage?: (chatId: string, content: string) => void;
}

const ChatWindow = ({ chat, messages, onSendMessage }: ChatWindowProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);
  
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
  
  const getStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <Check className="h-3 w-3 text-blue-500" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
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
  
  const formatMacroMessage = (content: string) => {
    if (content.startsWith("ASK")) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="macro-text">
                {content}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p>I'm looking for 10 times 1 KG gold bars according to the LBMA good delivery criteria, pricing based on London fixing + 0.3% premium</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else if (content.includes("Airwaybill")) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="macro-text">
                {content}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p>Could you send me the Airwaybill document for delivery #123456?</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return content;
  };

  const handleSendMessage = (content: string) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timestamp = `${hours}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
    
    const newMessage: Message = {
      id: `${chat.id}-${Date.now()}`,
      content,
      sender: "You",
      timestamp,
      status: "sent",
      isMine: true,
      isMacro: content.startsWith("ASK ") || content.startsWith("BID ") || content.includes("Airwaybill for")
    };
    
    setLocalMessages(prev => [...prev, newMessage]);
    
    if (onSendMessage) {
      onSendMessage(chat.id, content);
    }
  };

  return (
    <div className="flex flex-col h-full">
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
      
      <div className="flex-1 p-4 overflow-y-auto scroll-hidden bg-accent/10">
        {localMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Info className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No messages yet</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Start the conversation by sending a message below
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {localMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.isMine ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  message.isMine ? "chat-bubble-sent" : "chat-bubble-received"
                )}>
                  {!message.isMine && (
                    <div className="font-semibold text-xs mb-1">
                      {message.sender}
                    </div>
                  )}
                  
                  <div>
                    {message.isMacro 
                      ? formatMacroMessage(message.content) 
                      : message.content
                    }
                  </div>
                  
                  <div className="text-xs mt-1 opacity-70 flex items-center justify-end gap-1">
                    {message.timestamp}
                    {message.isMine && getStatusIcon(message.status)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      <MessageInput chatId={chat.id} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatWindow;
