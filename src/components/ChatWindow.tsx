
import { useState, useEffect } from "react";
import { Chat, Message } from "@/types/chat";
import MessageInput from "@/components/MessageInput";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  onSendMessage?: (chatId: string, content: string) => void;
}

const ChatWindow = ({ chat, messages, onSendMessage }: ChatWindowProps) => {
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  const handleSendMessage = (content: string) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timestamp = `${hours}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
    
    const newMessage: Message = {
      id: `${chat.id}-${Date.now()}`,
      content,
      sender: "You",
      timestamp,
      status: "sent",
      isMine: true,
      isMacro: content.startsWith("ASK ") || content.startsWith("BID ") || content.includes("Airwaybill for")
    };
    
    setLocalMessages(prev => [...prev, newMessage]);
    
    if (onSendMessage) {
      onSendMessage(chat.id, content);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ChatHeader chat={chat} />
      <MessageList messages={localMessages} />
      <MessageInput chatId={chat.id} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatWindow;
