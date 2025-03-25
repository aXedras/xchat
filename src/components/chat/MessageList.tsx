
import { useRef, useEffect } from "react";
import { Message } from "@/types/chat";
import ChatMessage from "./ChatMessage";
import EmptyState from "./EmptyState";
import TypingIndicator from "./TypingIndicator";

interface MessageListProps {
  messages: Message[];
  isTyping?: boolean;
  chatName?: string;
}

const MessageList = ({ messages, isTyping, chatName = "User" }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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
          <ChatMessage key={message.id} message={message} />
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
