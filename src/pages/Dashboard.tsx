
import { useState } from "react";
import Header from "@/components/Header";
import ChatList from "@/components/ChatList";
import ChatWindow from "@/components/ChatWindow";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import CompanySelector from "@/components/CompanySelector";
import { Dialog } from "@/components/ui/dialog";

export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar?: string;
  isGroup?: boolean;
  isCompany?: boolean;
  members?: string[];
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
  isMine: boolean;
  isMacro?: boolean;
}

const Dashboard = () => {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  
  const chats: Chat[] = [
    {
      id: "1",
      name: "Jane Smith - Argor-Heraeus",
      lastMessage: "ASK 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3",
      timestamp: "10:23 AM",
      unread: 2,
      avatar: "https://source.unsplash.com/random/40x40/?portrait&1"
    },
    {
      id: "2",
      name: "Michael Thompson - PAMP",
      lastMessage: "Will send you the certification details soon",
      timestamp: "Yesterday",
      unread: 0,
      avatar: "https://source.unsplash.com/random/40x40/?portrait&2"
    },
    {
      id: "3",
      name: "Refiners Group",
      lastMessage: "John: Can anyone share recent audit experiences?",
      timestamp: "Monday",
      unread: 5,
      isGroup: true,
      members: ["You", "John Davis", "Sarah Miller", "Robert Chen"]
    },
    {
      id: "4",
      name: "North American Operations",
      lastMessage: "Price update for March contracts",
      timestamp: "03/15/2023",
      unread: 0,
      isCompany: true
    },
    {
      id: "5",
      name: "Sarah Miller - Valcambi",
      lastMessage: "Ask Airwaybill for #123456",
      timestamp: "03/10/2023",
      unread: 0,
      avatar: "https://source.unsplash.com/random/40x40/?portrait&3"
    }
  ];
  
  const messages: Record<string, Message[]> = {
    "1": [
      {
        id: "1-1",
        content: "Hello, I'm looking for gold bars for our client",
        sender: "Jane Smith",
        timestamp: "10:20 AM",
        status: "read",
        isMine: false
      },
      {
        id: "1-2",
        content: "We have several options available. What specifications are you looking for?",
        sender: "You",
        timestamp: "10:21 AM",
        status: "read",
        isMine: true
      },
      {
        id: "1-3",
        content: "ASK 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3",
        sender: "Jane Smith",
        timestamp: "10:23 AM",
        status: "read",
        isMine: false,
        isMacro: true
      }
    ],
    "2": [
      {
        id: "2-1",
        content: "I need information about your platinum supply chain",
        sender: "Michael Thompson",
        timestamp: "Yesterday 3:45 PM",
        status: "read",
        isMine: false
      },
      {
        id: "2-2",
        content: "I'll prepare a document with our supply chain details. Do you need specific certification?",
        sender: "You",
        timestamp: "Yesterday 4:00 PM",
        status: "read",
        isMine: true
      },
      {
        id: "2-3",
        content: "Yes, we need LBMA chain of custody documentation",
        sender: "Michael Thompson",
        timestamp: "Yesterday 4:15 PM",
        status: "read",
        isMine: false
      },
      {
        id: "2-4",
        content: "Will send you the certification details soon",
        sender: "Michael Thompson",
        timestamp: "Yesterday 4:16 PM",
        status: "delivered",
        isMine: false
      }
    ]
  };
  
  const handleNewChat = () => {
    setShowNewChat(true);
  };
  
  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="font-semibold">Messages</h2>
            <Button variant="ghost" size="icon" onClick={handleNewChat}>
              <PlusCircle className="h-5 w-5" />
            </Button>
          </div>
          
          <ChatList 
            chats={chats} 
            selectedChat={selectedChat} 
            onSelectChat={handleChatSelect} 
          />
        </div>
        
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <ChatWindow 
              chat={selectedChat} 
              messages={messages[selectedChat.id] || []} 
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-accent-foreground">aX</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Welcome to aXedras Chat</h2>
              <p className="text-muted-foreground max-w-md">
                Select a conversation or start a new chat with companies and professionals in the precious metals industry
              </p>
              <Button className="mt-6" onClick={handleNewChat}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Start New Conversation
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <CompanySelector onClose={() => setShowNewChat(false)} />
      </Dialog>
    </div>
  );
};

export default Dashboard;
