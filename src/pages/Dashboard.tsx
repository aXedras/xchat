import { useState } from "react";
import Header from "@/components/Header";
import ChatList from "@/components/ChatList";
import ChatWindow from "@/components/ChatWindow";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import CompanySelector from "@/components/CompanySelector";
import { Dialog } from "@/components/ui/dialog";
import { useChatState } from "@/hooks/useChatState";

const Dashboard = () => {
  const {
    selectedChat,
    activeChats,
    messages,
    participants,
    quoteInvitations,
    quoteResponses,
    error,
    sending,
    handleChatSelect,
    sendDirect,
    sendToRecipients,
    sendRfq,
    retryDispatch,
    loadQuoteResponses,
    submitQuote,
    counterQuote,
    rejectQuote,
    bookQuote,
    setSelectedChat,
  } = useChatState();

  const [showNewChat, setShowNewChat] = useState(false);

  const handleSendMessage = async (content: string): Promise<boolean> => {
    if (!selectedChat?.counterpartyUserId) {
      return false;
    }
    return sendDirect(selectedChat.counterpartyUserId, content);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="font-semibold">Messages</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNewChat(true)}
            >
              <PlusCircle className="h-5 w-5" />
            </Button>
          </div>

          <ChatList
            chats={activeChats}
            selectedChat={selectedChat}
            onSelectChat={handleChatSelect}
          />
        </div>

        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              messages={messages[selectedChat.id] || []}
              sending={sending}
              error={error}
              invitations={quoteInvitations.filter(
                (inv) => inv.conversationId === selectedChat.id,
              )}
              responses={quoteResponses}
              onSendMessage={handleSendMessage}
              onLoadResponses={loadQuoteResponses}
              onSubmitQuote={submitQuote}
              onCounterQuote={counterQuote}
              onRejectQuote={rejectQuote}
              onBookQuote={bookQuote}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-accent-foreground">
                  xC
                </span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                Welcome to the xChat
              </h2>
              <p className="text-muted-foreground max-w-md">
                Select a conversation or start a new chat with participants in
                the precious metals industry
              </p>
              {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
              <Button className="mt-6" onClick={() => setShowNewChat(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Start New Conversation
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <CompanySelector
          open={showNewChat}
          participants={participants}
          sending={sending}
          onClose={() => setShowNewChat(false)}
          onSend={sendToRecipients}
          onSendRfq={sendRfq}
          onRetry={retryDispatch}
        />
      </Dialog>
    </div>
  );
};

export default Dashboard;
