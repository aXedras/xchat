import { Message } from "@/types/chat";
import { Check, CheckCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

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

const statusKey: Record<Message["status"], string | null> = {
  sent: "chat.sent",
  delivered: "chat.delivered",
  read: "chat.read",
};

const ChatMessage = ({ message }: ChatMessageProps) => {
  const { t } = useTranslation();
  const statusText = statusKey[message.status] ? t(statusKey[message.status]!) : "";

  return (
    <div className={cn("flex", message.isMine ? "justify-end" : "justify-start")}>
      <div className={cn(message.isMine ? "chat-bubble-sent" : "chat-bubble-received")}>
        {!message.isMine && <div className="font-semibold text-xs mb-1">{message.sender}</div>}

        <div>{message.content}</div>

        <div className="text-xs mt-1 opacity-70 flex items-center justify-end gap-1">
          {message.timestamp}
          {message.isMine && (
            <div className="flex items-center ml-1 gap-0.5" title={statusText}>
              {getStatusIcon(message.status)}
              <span className="text-[10px] text-muted-foreground ml-0.5">{statusText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
