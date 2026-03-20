
import { useRef, useEffect } from "react";
import { Message, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";
import ChatMessage from "./ChatMessage";
import EmptyState from "./EmptyState";
import TypingIndicator from "./TypingIndicator";
import { resolveQuoteRequest } from "@/utils/quoteRequest";

interface MessageListProps {
  chatId: string;
  messages: Message[];
  isTyping?: boolean;
  chatName?: string;
  quoteRequestsById?: Record<string, QuoteRequest>;
  quoteResponsesByRequest?: Record<string, QuoteResponse[]>;
  tradeDealsByRequest?: Record<string, TradeDeal[]>;
  onRespondToQuoteRequest?: (requestId: string) => void;
  onConvertQuoteResponseToDeal?: (requestId: string, responseId: string) => void;
}

const MessageList = ({ chatId, messages, isTyping, chatName = "User", quoteRequestsById, quoteResponsesByRequest, tradeDealsByRequest, onRespondToQuoteRequest, onConvertQuoteResponseToDeal }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const companyName = chatName.split(" - ")[1];
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (messages.length === 0 && !isTyping) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto scroll-hidden bg-accent/10">
      <div className="space-y-4">
        {messages.map((message) => (
          (() => {
            const quoteRequest = resolveQuoteRequest(message, chatId, quoteRequestsById, companyName);

            return (
              <ChatMessage
                key={message.id}
                message={message}
                quoteRequest={quoteRequest}
                responses={quoteRequest ? quoteResponsesByRequest?.[quoteRequest.id] : undefined}
                deals={quoteRequest ? tradeDealsByRequest?.[quoteRequest.id] : undefined}
                onRespond={onRespondToQuoteRequest}
                onConvertToDeal={onConvertQuoteResponseToDeal}
              />
            );
          })()
        ))}
        {isTyping && (
          <TypingIndicator name={chatName.split(" - ")[0]} />
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
