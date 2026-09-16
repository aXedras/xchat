import { useState } from "react";
import Header from "@/components/Header";
import ChatList from "@/components/ChatList";
import ChatWindow from "@/components/ChatWindow";
import { Button, buttonVariants } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import CompanySelector from "@/components/CompanySelector";
import { Dialog } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useChatState } from "@/hooks/useChatState";
import { useTranslation } from "react-i18next";
import { Chat } from "@/types/chat";

const Dashboard = () => {
  const { t } = useTranslation();
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
    deleteChat,
  } = useChatState();

  const [showNewChat, setShowNewChat] = useState(false);
  const [pendingDeleteChat, setPendingDeleteChat] = useState<Chat | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const handleSendMessage = async (content: string): Promise<boolean> => {
    if (!selectedChat?.counterpartyUserId) {
      return false;
    }
    return sendDirect(selectedChat.counterpartyUserId, content);
  };

  const handleRequestDeleteChat = (chatId: string) => {
    setPendingDeleteChat(activeChats.find((chat) => chat.id === chatId) ?? null);
  };

  const handleConfirmDeleteChat = async () => {
    if (!pendingDeleteChat) return;
    setIsDeletingChat(true);
    try {
      await deleteChat(pendingDeleteChat.id);
    } finally {
      setIsDeletingChat(false);
      setPendingDeleteChat(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="font-semibold">{t("dashboard.messages")}</h2>
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
            onDeleteChat={handleRequestDeleteChat}
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
                {t("dashboard.welcome")}
              </h2>
              <p className="text-muted-foreground max-w-md">
                {t("dashboard.welcomeText")}
              </p>
              {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
              <Button className="mt-6" onClick={() => setShowNewChat(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t("dashboard.startConversation")}
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

      <AlertDialog
        open={pendingDeleteChat !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingChat) setPendingDeleteChat(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("chat.deleteConfirmDescription", {
                name: pendingDeleteChat?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingChat}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingChat}
              className={buttonVariants({ variant: "destructive" })}
              onClick={(event) => {
                // Radix closes the dialog on click by default; we control
                // closing ourselves once the async delete has settled.
                event.preventDefault();
                void handleConfirmDeleteChat();
              }}
            >
              {t("chat.deleteChat")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
