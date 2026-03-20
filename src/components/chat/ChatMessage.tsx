
import { Message, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";
import { Check, CheckCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuoteRequestCountdown } from "@/hooks/useQuoteRequestCountdown";
import { QuoteWorkflowActions, QuoteWorkflowCard } from "@/components/chat/chat-message/QuoteWorkflow";
import { translateMessageContent } from "@/components/chat/chat-message/translateMessageContent";

interface ChatMessageProps {
  message: Message;
  quoteRequest?: QuoteRequest;
  responses?: QuoteResponse[];
  deals?: TradeDeal[];
  onRespond?: (requestId: string) => void;
  onConvertToDeal?: (requestId: string, responseId: string) => void;
}

const ChatMessage = ({ message, quoteRequest, responses = [], deals = [], onRespond, onConvertToDeal }: ChatMessageProps) => {
  const countdown = useQuoteRequestCountdown(quoteRequest);
  const latestResponse = responses.at(-1);
  const latestDeal = deals.at(-1);
  const countdownClassName = {
    healthy: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    critical: "bg-rose-100 text-rose-800",
    expired: "bg-slate-200 text-slate-700",
    neutral: "bg-accent text-accent-foreground",
  }[countdown.tone];
  const requestStatusLabel = {
    draft: "Draft",
    sent: "Open",
    open: "Open",
    expiring: "Expiring",
    expired: "Expired",
    quoted: "Quoted",
    withdrawn: "Withdrawn",
    converted: "Converted",
  }[countdown.requestStatus];
  const responseStatusLabel = latestResponse
    ? {
        submitted: "Quote Submitted",
        countered: "Quote Countered",
        accepted: "Quote Accepted",
        rejected: "Quote Rejected",
        withdrawn: "Quote Withdrawn",
        expired: "Quote Expired",
      }[latestResponse.status]
    : undefined;
  const dealStatusLabel = latestDeal
    ? {
        draft: "Deal Draft",
        booked: "Deal Booked",
        settled: "Deal Settled",
        cancelled: "Deal Cancelled",
      }[latestDeal.status]
    : undefined;
  // Get status icon based on message status
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

  // Get status text based on message status
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

  // Translate macro content to human-readable form
  // Check if this message should show action buttons (only for received macro messages)
  const shouldShowActions = !message.isMine && !!quoteRequest;
  const showWorkflowCard = !!quoteRequest;
  
  // Set the translated content
  const displayContent = message.isMacro 
    ? translateMessageContent(message.content, quoteRequest) 
    : message.content;

  return (
    <div
      className={cn(
        "flex",
        message.isMine ? "justify-end" : "justify-start"
      )}
    >
      <div 
        className={cn(
          message.isMine ? "chat-bubble-sent" : "chat-bubble-received",
          message.isMacro && "macro-message"
        )}
      >
        {!message.isMine && (
          <div className="font-semibold text-xs mb-1">
            {message.sender}
          </div>
        )}
        
        <div>
          {displayContent}

          {showWorkflowCard && (
            <QuoteWorkflowCard
              message={message}
              quoteRequest={quoteRequest}
              latestResponse={latestResponse}
              latestDeal={latestDeal}
              requestStatusLabel={requestStatusLabel}
              countdownLabel={countdown.label}
              countdownClassName={countdownClassName}
              responseStatusLabel={responseStatusLabel}
              dealStatusLabel={dealStatusLabel}
            />
          )}
          
          {message.isMacro && (
            <div className="text-xs mt-1 bg-background/20 px-2 py-1 rounded text-muted-foreground">
              <span className="font-mono">Macro: {message.content}</span>
            </div>
          )}
        </div>
        
        {shouldShowActions && (
          <QuoteWorkflowActions
            quoteRequest={quoteRequest}
            latestResponse={latestResponse}
            latestDeal={latestDeal}
            canRespond={countdown.canRespond}
            canConvert={countdown.canConvert}
            onRespond={onRespond}
            onConvertToDeal={onConvertToDeal}
          />
        )}
        
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
