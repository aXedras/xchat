import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Chat, QuoteInvitationRecord } from "@/types/chat";
import CustomerView from "./CustomerView";
import InventoryView from "./InventoryView";
import { useTranslation } from "react-i18next";

type TabId = "customer" | "inventory";

interface SidePanelContainerProps {
  chat: Chat;
  invitations: QuoteInvitationRecord[];
}

const SidePanelContainer = ({ chat, invitations }: SidePanelContainerProps) => {
  const { t } = useTranslation();
  const hasRfq = invitations.length > 0;
  const [activeTab, setActiveTab] = useState<TabId>("customer");
  const prevChatIdRef = useRef(chat.id);

  useEffect(() => {
    const prevChatId = prevChatIdRef.current;
    prevChatIdRef.current = chat.id;

    if (chat.id !== prevChatId) {
      // Chat switch: fall back to the default tab.
      setActiveTab("customer");
    }
  }, [chat.id]);

  const tabs: Array<{ id: TabId; label: string; visible: boolean }> = [
    { id: "customer", label: t("sidePanel.customer"), visible: true },
    { id: "inventory", label: t("sidePanel.inventory"), visible: hasRfq },
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
      </div>
    </div>
  );
};

export default SidePanelContainer;
