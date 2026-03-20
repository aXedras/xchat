import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuoteRequestCountdown } from "@/hooks/useQuoteRequestCountdown";
import { DealHistoryCard, LinkedDealCard } from "@/components/chat/ask-context/DealCards";
import { ResponseCard } from "@/components/chat/ask-context/ResponseCard";
import {
  CounterpartyInsight,
  QuoteRequest,
  QuoteResponse,
  TradeDeal,
} from "@/types/chat";
import { ClipboardList, FileText, ShieldCheck } from "lucide-react";

interface AskContextPanelProps {
  quoteRequest: QuoteRequest;
  responses?: QuoteResponse[];
  deals?: TradeDeal[];
  insight?: CounterpartyInsight;
  onRespond?: (requestId: string) => void;
  onCounterResponse?: (requestId: string, responseId: string) => void;
  onRejectResponse?: (requestId: string, responseId: string) => void;
  onConvertToDeal?: (requestId: string, responseId: string) => void;
}

const statusConfig = {
  onboarded: {
    label: "KYC onboarded",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  "in-review": {
    label: "KYC in review",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  "not-onboarded": {
    label: "Not onboarded",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
} as const;

const termFieldClassName = "rounded-md border border-border/60 bg-muted/30 p-2";

const AskContextPanel = ({ quoteRequest, responses = [], deals = [], insight, onRespond, onCounterResponse, onRejectResponse, onConvertToDeal }: AskContextPanelProps) => {
  const countdown = useQuoteRequestCountdown(quoteRequest);
  const latestResponse = responses.at(-1);
  const latestDeal = deals.at(-1);

  const status = insight ? statusConfig[insight.kycStatus] : statusConfig["not-onboarded"];
  const convertedDeals = insight?.requestHistory.filter((request) => request.linkedDealId).length ?? 0;
  const deadlineClassName = {
    healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    critical: "bg-rose-100 text-rose-800 border-rose-200",
    expired: "bg-slate-200 text-slate-700 border-slate-300",
    neutral: "bg-background text-foreground border-border",
  }[countdown.tone];
  const requestStatusClassName = {
    open: "bg-emerald-100 text-emerald-800 border-emerald-200",
    expiring: "bg-amber-100 text-amber-800 border-amber-200",
    expired: "bg-slate-200 text-slate-700 border-slate-300",
    quoted: "bg-blue-100 text-blue-800 border-blue-200",
    converted: "bg-violet-100 text-violet-800 border-violet-200",
    sent: "bg-emerald-100 text-emerald-800 border-emerald-200",
  }[countdown.requestStatus];
  const requestStatusLabel = {
    open: "Open",
    expiring: "Expiring",
    expired: "Expired",
    quoted: "Quoted",
    converted: "Converted",
    sent: "Open",
  }[countdown.requestStatus];

  return (
    <aside className="border-t border-border bg-background xl:w-96 xl:border-l xl:border-t-0">
      <ScrollArea className="h-full max-h-[28rem] xl:max-h-none">
        <div className="space-y-4 p-4">
          <Card className="border-primary/20 bg-primary/5 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Live ask context
                  </p>
                  <CardTitle className="mt-2 text-lg">{insight?.company ?? quoteRequest.requestedBy}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Current inbound request from {insight?.counterparty ?? quoteRequest.requestedBy}
                  </p>
                </div>
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-background p-3">
                <div className="flex items-center justify-between gap-2 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Active request
                  </div>
                  {quoteRequest.responseDeadline && (
                    <Badge variant="outline" className={deadlineClassName}>
                      {countdown.label}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Request type</p>
                    <p className="mt-1 font-medium">{quoteRequest.type}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Request status</p>
                    <div className="mt-1">
                      <Badge variant="outline" className={requestStatusClassName}>
                        {requestStatusLabel}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Quantity</p>
                    <p className="mt-1 font-medium">{quoteRequest.terms.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Product</p>
                    <p className="mt-1 font-medium">{quoteRequest.terms.product} ({quoteRequest.terms.productCode})</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Quality</p>
                    <p className="mt-1 font-medium">{quoteRequest.terms.quality}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Location</p>
                    <p className="mt-1 font-medium">{quoteRequest.terms.location}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Price basis</p>
                    <p className="mt-1 font-medium">{quoteRequest.terms.priceBasis}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium</p>
                    <p className="mt-1 font-medium">{quoteRequest.terms.premium}</p>
                  </div>
                  {quoteRequest.responseDeadline && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Response TTL</p>
                      <p className="mt-1 font-medium">{countdown.label}</p>
                    </div>
                  )}
                  {quoteRequest.terms.fees && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Fees</p>
                      <p className="mt-1 font-medium">{quoteRequest.terms.fees}</p>
                    </div>
                  )}
                  {quoteRequest.terms.vat && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">VAT / MwSt</p>
                      <p className="mt-1 font-medium">{quoteRequest.terms.vat}</p>
                    </div>
                  )}
                  {quoteRequest.terms.notes && (
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                      <p className="mt-1 font-medium">{quoteRequest.terms.notes}</p>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Raw macro terms</p>
                    <p className="mt-1 font-medium">{quoteRequest.terms.rawTerms}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Counterparty status
                </div>
                <p className="mt-2 text-muted-foreground">
                  {insight?.onboardingNote ?? "No onboarding record available for this counterparty yet."}
                </p>
                {countdown.isExpired && (
                  <p className="mt-3 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700">
                    This quote request has expired. Any response should be treated as a new request or re-opened RFQ.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => onRespond?.(quoteRequest.id)}
                    disabled={!countdown.canRespond || !!latestResponse}
                  >
                    Send Quote
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => latestResponse && onCounterResponse?.(quoteRequest.id, latestResponse.id)}
                    disabled={!latestResponse || !!latestDeal || latestResponse.status === "accepted" || latestResponse.status === "rejected"}
                  >
                    Counter Quote
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => latestResponse && onRejectResponse?.(quoteRequest.id, latestResponse.id)}
                    disabled={!latestResponse || !!latestDeal || latestResponse.status === "accepted" || latestResponse.status === "rejected"}
                  >
                    Reject Quote
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => latestResponse && onConvertToDeal?.(quoteRequest.id, latestResponse.id)}
                    disabled={!latestResponse || !!latestDeal || !["submitted", "countered"].includes(latestResponse.status) || !countdown.canConvert}
                  >
                    {latestDeal ? "Deal Booked" : "Accept As Deal"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <ResponseCard responses={responses} />

          <LinkedDealCard latestDeal={latestDeal} />

          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Request history
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insight?.requestHistory.length ? (
                insight.requestHistory.map((request) => (
                  <div key={request.id} className="rounded-lg border border-border/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{request.summary}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{request.date}</p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No prior requests recorded for this party.</p>
              )}
            </CardContent>
          </Card>

          <DealHistoryCard deals={insight?.dealHistory ?? []} convertedDeals={convertedDeals} />
        </div>
      </ScrollArea>
    </aside>
  );
};

export default AskContextPanel;