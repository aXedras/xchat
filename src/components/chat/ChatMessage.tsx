import { Message, QuoteInvitationRecord, QuoteResponseRecord } from "@/types/chat";
import { Check, CheckCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import RfqPanel from "./RfqPanel";

export interface RfqMessageContext {
  invitation: QuoteInvitationRecord;
  responses: QuoteResponseRecord[];
  isOwner: boolean;
  busy: boolean;
  onLoadResponses: (invitationId: string) => void;
  onSubmitQuote: (invitationId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onCounterQuote: (invitationId: string, parentResponseId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onRejectQuote: (invitationId: string, responseId: string) => Promise<unknown>;
  onBookQuote: (invitationId: string, responseId: string) => Promise<unknown>;
}

interface ChatMessageProps {
  message: Message;
  rfq?: RfqMessageContext;
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

const ChatMessage = ({ message, rfq }: ChatMessageProps) => {
  const { t } = useTranslation();
  const statusText = statusKey[message.status] ? t(statusKey[message.status]!) : "";

  if (rfq) {
    return (
      <div className="flex flex-col max-w-[85%] animate-fade-in">
        {!message.isMine && <div className="font-semibold text-xs mb-1">{message.sender}</div>}
        <RfqPanel
          className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm"
          invitation={rfq.invitation}
          responses={rfq.responses}
          isOwner={rfq.isOwner}
          busy={rfq.busy}
          onLoadResponses={rfq.onLoadResponses}
          onSubmitQuote={rfq.onSubmitQuote}
          onCounterQuote={rfq.onCounterQuote}
          onRejectQuote={rfq.onRejectQuote}
          onBookQuote={rfq.onBookQuote}
        />
        <div className="text-xs mt-1 opacity-70 flex items-center justify-end gap-1">
          {message.timestamp}
          {message.isMine && getStatusIcon(message.status)}
        </div>
      </div>
    );
  }

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
