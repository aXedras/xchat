import { useRef, useEffect, useMemo } from "react";
import { Message, QuoteInvitationRecord, QuoteResponseRecord } from "@/types/chat";
import ChatMessage, { RfqMessageContext } from "./ChatMessage";
import EmptyState from "./EmptyState";

interface MessageListProps {
  messages: Message[];
  invitations: QuoteInvitationRecord[];
  responses: Record<string, QuoteResponseRecord[]>;
  currentUserId: string | null;
  busy: boolean;
  onLoadResponses: (invitationId: string) => void;
  onSubmitQuote: (invitationId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onCounterQuote: (invitationId: string, parentResponseId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onRejectQuote: (invitationId: string, responseId: string) => Promise<unknown>;
  onBookQuote: (invitationId: string, responseId: string) => Promise<unknown>;
}

const MessageList = ({
  messages,
  invitations,
  responses,
  currentUserId,
  busy,
  onLoadResponses,
  onSubmitQuote,
  onCounterQuote,
  onRejectQuote,
  onBookQuote,
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const invitationByMessageId = useMemo(
    () =>
      new Map(invitations.map((invitation) => [invitation.messageId, invitation])),
    [invitations],
  );

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto scroll-hidden bg-accent/10">
      <div className="space-y-4">
        {messages.map((message) => {
          const invitation = invitationByMessageId.get(message.id);
          const rfq: RfqMessageContext | undefined = invitation
            ? {
                invitation,
                responses: responses[invitation.id] ?? [],
                isOwner: !!currentUserId && invitation.ownerUserId === currentUserId,
                busy,
                onLoadResponses,
                onSubmitQuote,
                onCounterQuote,
                onRejectQuote,
                onBookQuote,
              }
            : undefined;

          return <ChatMessage key={message.id} message={message} rfq={rfq} />;
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;
