
import { Message } from "@/types/chat";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
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

  return (
    <div
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
  );
};

export default ChatMessage;
