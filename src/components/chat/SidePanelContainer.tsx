import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Chat, QuoteInvitationRecord, QuoteResponseRecord } from "@/types/chat";
import CustomerView from "./CustomerView";
import InventoryView from "./InventoryView";
import RfqPanel from "./RfqPanel";

type TabId = "customer" | "rfq" | "inventory";

interface SidePanelContainerProps {
  chat: Chat;
  currentUserId: string | null;
  invitations: QuoteInvitationRecord[];
  responses: Record<string, QuoteResponseRecord[]>;
  busy: boolean;
  onLoadResponses: (invitationId: string) => void;
  onSubmitQuote: (
    invitationId: string,
    premium: string,
    notes?: string | null,
  ) => Promise<unknown>;
  onCounterQuote: (
    invitationId: string,
    parentResponseId: string,
    premium: string,
    notes?: string | null,
  ) => Promise<unknown>;
  onRejectQuote: (invitationId: string, responseId: string) => Promise<unknown>;
  onBookQuote: (invitationId: string, responseId: string) => Promise<unknown>;
}

const SidePanelContainer = ({
  chat,
  currentUserId,
  invitations,
  responses,
  busy,
  onLoadResponses,
  onSubmitQuote,
  onCounterQuote,
  onRejectQuote,
  onBookQuote,
}: SidePanelContainerProps) => {
  const hasRfq = invitations.length > 0;
  const [activeTab, setActiveTab] = useState<TabId>(
    hasRfq ? "rfq" : "customer",
  );
  const prevChatIdRef = useRef(chat.id);
  const prevHasRfqRef = useRef(hasRfq);

  useEffect(() => {
    const prevChatId = prevChatIdRef.current;
    const prevHasRfq = prevHasRfqRef.current;
    prevChatIdRef.current = chat.id;
    prevHasRfqRef.current = hasRfq;

    if (chat.id !== prevChatId) {
      // Chat switch: always fall back to the context-appropriate default tab.
      setActiveTab(hasRfq ? "rfq" : "customer");
      return;
    }
    if (hasRfq && !prevHasRfq) {
      // RFQ newly available in the same chat: surface it by default.
      setActiveTab("rfq");
      return;
    }
    if (!hasRfq && prevHasRfq) {
      // RFQ context disappeared: rfq/inventory tabs are no longer visible.
      setActiveTab("customer");
    }
  }, [chat.id, hasRfq]);

  const tabs: Array<{ id: TabId; label: string; visible: boolean }> = [
    { id: "customer", label: "Customer", visible: true },
    { id: "rfq", label: "RFQ Context", visible: hasRfq },
    { id: "inventory", label: "Inventory", visible: hasRfq },
  ];

  return (
    <div className="border-l border-border flex flex-col w-full xl:w-96 min-h-0">
      <div className="flex border-b border-border">
        {tabs
          .filter((tab) => tab.visible)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-2 text-sm transition-colors",
                activeTab === tab.id
                  ? "border-b-2 border-primary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "customer" && <CustomerView chat={chat} />}
        {activeTab === "inventory" && <InventoryView />}
        {activeTab === "rfq" &&
          invitations.map((invitation) => (
            <RfqPanel
              key={invitation.id}
              invitation={invitation}
              responses={responses[invitation.id] ?? []}
              isOwner={
                !!currentUserId && invitation.ownerUserId === currentUserId
              }
              busy={busy}
              onLoadResponses={onLoadResponses}
              onSubmitQuote={onSubmitQuote}
              onCounterQuote={onCounterQuote}
              onRejectQuote={onRejectQuote}
              onBookQuote={onBookQuote}
            />
          ))}
      </div>
    </div>
  );
};

export default SidePanelContainer;
