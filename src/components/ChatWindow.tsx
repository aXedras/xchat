import { Chat, Message, QuoteInvitationRecord, QuoteResponseRecord } from "@/types/chat";
import MessageInput from "@/components/MessageInput";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import SidePanelContainer from "./chat/SidePanelContainer";
import { getCurrentParticipant } from "@/services/chatIdentity";

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  sending: boolean;
  error: string | null;
  invitations: QuoteInvitationRecord[];
  responses: Record<string, QuoteResponseRecord[]>;
  onSendMessage: (content: string) => Promise<boolean> | boolean;
  onLoadResponses: (invitationId: string) => Promise<void>;
  onSubmitQuote: (invitationId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onCounterQuote: (invitationId: string, parentResponseId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onRejectQuote: (invitationId: string, responseId: string) => Promise<unknown>;
  onBookQuote: (invitationId: string, responseId: string) => Promise<unknown>;
}

const ChatWindow = ({
  chat,
  messages,
  sending,
  error,
  invitations,
  responses,
  onSendMessage,
  onLoadResponses,
  onSubmitQuote,
  onCounterQuote,
  onRejectQuote,
  onBookQuote,
}: ChatWindowProps) => {
  const currentUserId = getCurrentParticipant()?.userId;

  return (
    <div className="flex flex-col h-full">
      <ChatHeader chat={chat} />
      {error && (
        <div className="mx-4 mt-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
        <div className="min-h-0 flex-1 flex flex-col">
          <MessageList messages={messages} />
          <MessageInput disabled={sending} onSendMessage={onSendMessage} />
        </div>
        <SidePanelContainer
          chat={chat}
          currentUserId={currentUserId}
          invitations={invitations}
          responses={responses}
          busy={sending}
          onLoadResponses={onLoadResponses}
          onSubmitQuote={onSubmitQuote}
          onCounterQuote={onCounterQuote}
          onRejectQuote={onRejectQuote}
          onBookQuote={onBookQuote}
        />
      </div>
    </div>
  );
};

export default ChatWindow;
