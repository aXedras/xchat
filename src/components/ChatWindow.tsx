
import { counterpartyInsights } from "@/data/mockChats";
import { Chat, Message, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";
import MessageInput from "@/components/MessageInput";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import AskContextPanel from "./chat/AskContextPanel";
import { isQuoteRequestMacro } from "@/utils/askMacro";
import { resolveQuoteRequest } from "@/utils/quoteRequest";

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  quoteRequestsById?: Record<string, QuoteRequest>;
  quoteResponsesByRequest?: Record<string, QuoteResponse[]>;
  tradeDealsByRequest?: Record<string, TradeDeal[]>;
  onSendMessage?: (chatId: string, content: string) => void;
  onRespondToQuoteRequest?: (chatId: string, requestId: string) => void;
  onCounterQuoteResponse?: (chatId: string, requestId: string, responseId: string) => void;
  onRejectQuoteResponse?: (chatId: string, requestId: string, responseId: string) => void;
  onConvertQuoteResponseToDeal?: (chatId: string, requestId: string, responseId: string) => void;
  isTyping?: boolean;
}

const ChatWindow = ({ chat, messages, quoteRequestsById, quoteResponsesByRequest, tradeDealsByRequest, onSendMessage, onRespondToQuoteRequest, onCounterQuoteResponse, onRejectQuoteResponse, onConvertQuoteResponseToDeal, isTyping }: ChatWindowProps) => {
  const counterpartyInsight = counterpartyInsights[chat.id];

  const activeAskMessage = [...messages]
    .reverse()
    .find((message) => !message.isMine && isQuoteRequestMacro(message.content));

  const activeQuoteRequest = activeAskMessage
    ? resolveQuoteRequest(activeAskMessage, chat.id, quoteRequestsById, counterpartyInsight?.company)
    : undefined;

  const handleSendMessage = (content: string) => {
    if (onSendMessage) {
      onSendMessage(chat.id, content);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ChatHeader chat={chat} />
      <div className="flex flex-1 min-h-0 flex-col xl:flex-row">
        <div className="min-h-0 flex-1">
          <MessageList 
            chatId={chat.id}
            messages={messages} 
            isTyping={isTyping} 
            chatName={chat.name} 
            quoteRequestsById={quoteRequestsById}
            quoteResponsesByRequest={quoteResponsesByRequest}
            tradeDealsByRequest={tradeDealsByRequest}
            onRespondToQuoteRequest={(requestId) => onRespondToQuoteRequest?.(chat.id, requestId)}
            onConvertQuoteResponseToDeal={(requestId, responseId) => onConvertQuoteResponseToDeal?.(chat.id, requestId, responseId)}
          />
        </div>
        {activeAskMessage && activeQuoteRequest && (
          <AskContextPanel
            quoteRequest={activeQuoteRequest}
            responses={quoteResponsesByRequest?.[activeQuoteRequest.id]}
            deals={tradeDealsByRequest?.[activeQuoteRequest.id]}
            insight={counterpartyInsight}
            onRespond={(requestId) => onRespondToQuoteRequest?.(chat.id, requestId)}
            onCounterResponse={(requestId, responseId) => onCounterQuoteResponse?.(chat.id, requestId, responseId)}
            onRejectResponse={(requestId, responseId) => onRejectQuoteResponse?.(chat.id, requestId, responseId)}
            onConvertToDeal={(requestId, responseId) => onConvertQuoteResponseToDeal?.(chat.id, requestId, responseId)}
          />
        )}
      </div>
      <MessageInput chatId={chat.id} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatWindow;
