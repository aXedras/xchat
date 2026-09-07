import { Message } from "@/types/chat";
import { Check, CheckCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
}

const getStatusIcon = (status: Message["status"]) => {
  switch (status) {
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case "read":
      return <Eye className="h-3 w-3 text-blue-500" />;
    default:
      return null;
  }
};

const getStatusText = (status: Message["status"]) => {
  switch (status) {
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "read":
      return "Read";
    default:
      return "";
  }
};

const ChatMessage = ({ message }: ChatMessageProps) => {
  return (
    <div className={cn("flex", message.isMine ? "justify-end" : "justify-start")}>
      <div className={cn(message.isMine ? "chat-bubble-sent" : "chat-bubble-received")}>
        {!message.isMine && <div className="font-semibold text-xs mb-1">{message.sender}</div>}

        <div>{message.content}</div>

        <div className="text-xs mt-1 opacity-70 flex items-center justify-end gap-1">
          {message.timestamp}
          {message.isMine && (
            <div className="flex items-center ml-1 gap-0.5" title={getStatusText(message.status)}>
              {getStatusIcon(message.status)}
              <span className="text-[10px] text-muted-foreground ml-0.5">{getStatusText(message.status)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
