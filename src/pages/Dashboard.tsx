
import { useState } from "react";
import Header from "@/components/Header";
import ChatList from "@/components/ChatList";
import ChatWindow from "@/components/ChatWindow";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import CompanySelector from "@/components/CompanySelector";
import { Dialog } from "@/components/ui/dialog";
import { useChatState } from "@/hooks/useChatState";
import { Chat } from "@/types/chat";

const Dashboard = () => {
  const {
    selectedChat,
    showNewChat,
    chats,
    messages,
    handleNewChat,
    handleChatSelect,
    createNewChat,
    setShowNewChat,
    deleteChat,
    archiveChat
  } = useChatState();

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
            onDeleteChat={deleteChat}
            onArchiveChat={archiveChat}
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
        <CompanySelector onClose={() => setShowNewChat(false)} onCreateChat={createNewChat} />
      </Dialog>
    </div>
  );
};

export default Dashboard;
