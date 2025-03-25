
import { useState, useEffect } from "react";
import { Chat, Message } from "@/types/chat";
import MessageInput from "@/components/MessageInput";
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  onSendMessage?: (chatId: string, content: string) => void;
  isTyping?: boolean;
}

const ChatWindow = ({ chat, messages, onSendMessage, isTyping }: ChatWindowProps) => {
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  const checkForMacros = (text: string) => {
    if (text.startsWith("ASK ") || 
        text.startsWith("BID ") || 
        text.startsWith("OFFER ") ||
        text.includes("Airwaybill") ||
        text.includes("CoO for") ||
        text.includes("Analysis for")) {
      return true;
    }
    return false;
  };

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
      isMacro: checkForMacros(content)
    };
    
    setLocalMessages(prev => [...prev, newMessage]);
    
    if (onSendMessage) {
      onSendMessage(chat.id, content);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ChatHeader chat={chat} />
      <MessageList 
        messages={localMessages} 
        isTyping={isTyping} 
        chatName={chat.name} 
      />
      <MessageInput chatId={chat.id} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatWindow;
