import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CounterpartyInsight, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";
import AskContextPanel from "./AskContextPanel";
import CustomerView from "./CustomerView";
import InventoryView from "./InventoryView";
import { BookUser, ClipboardList, Warehouse } from "lucide-react";

interface SidePanelContainerProps {
  chatId: string;
  insight?: CounterpartyInsight;
  quoteRequest?: QuoteRequest;
  responses?: QuoteResponse[];
  deals?: TradeDeal[];
  onRespond?: (requestId: string) => void;
  onCounterResponse?: (requestId: string, responseId: string) => void;
  onRejectResponse?: (requestId: string, responseId: string) => void;
  onConvertToDeal?: (requestId: string, responseId: string) => void;
}

const SidePanelContainer = ({
  chatId,
  insight,
  quoteRequest,
  responses,
  deals,
  onRespond,
  onCounterResponse,
  onRejectResponse,
  onConvertToDeal,
}: SidePanelContainerProps) => {
  const hasActiveRfq = !!quoteRequest;
  const defaultTab = hasActiveRfq ? "rfq" : "customer";

  return (
    <aside className="flex flex-col border-t border-border bg-background xl:w-96 xl:border-l xl:border-t-0">
      <Tabs defaultValue={defaultTab} className="flex h-full flex-col">
        <TabsList className="mx-4 mt-3 shrink-0">
          <TabsTrigger value="customer" className="gap-1.5">
            <BookUser className="h-3.5 w-3.5" />
            Customer
          </TabsTrigger>
          {hasActiveRfq && (
            <>
              <TabsTrigger value="rfq" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                RFQ
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-1.5">
                <Warehouse className="h-3.5 w-3.5" />
                Inventory
              </TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="customer" className="mt-0 min-h-0 flex-1">
          <CustomerView chatId={chatId} insight={insight} />
        </TabsContent>
        {hasActiveRfq && (
          <>
            <TabsContent value="rfq" className="mt-0 min-h-0 flex-1">
              <AskContextPanel
                quoteRequest={quoteRequest}
                responses={responses}
                deals={deals}
                insight={insight}
                onRespond={onRespond}
                onCounterResponse={onCounterResponse}
                onRejectResponse={onRejectResponse}
                onConvertToDeal={onConvertToDeal}
              />
            </TabsContent>
            <TabsContent value="inventory" className="mt-0 min-h-0 flex-1">
              <InventoryView />
            </TabsContent>
          </>
        )}
      </Tabs>
    </aside>
  );
};

export default SidePanelContainer;
