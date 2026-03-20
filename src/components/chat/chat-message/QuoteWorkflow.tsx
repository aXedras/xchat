import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Message, QuoteRequest, QuoteResponse, TradeDeal } from "@/types/chat";
import { Handshake, ReceiptText } from "lucide-react";

interface QuoteWorkflowCardProps {
  message: Message;
  quoteRequest: QuoteRequest;
  latestResponse?: QuoteResponse;
  latestDeal?: TradeDeal;
  requestStatusLabel: string;
  countdownLabel: string;
  countdownClassName: string;
  responseStatusLabel?: string;
  dealStatusLabel?: string;
}

export function QuoteWorkflowCard({
  message,
  quoteRequest,
  latestResponse,
  latestDeal,
  requestStatusLabel,
  countdownLabel,
  countdownClassName,
  responseStatusLabel,
  dealStatusLabel,
}: Readonly<QuoteWorkflowCardProps>) {
  const responseVersionLabel = latestResponse ? `v${latestResponse.version}` : undefined;

  return (
    <div className="mt-3 rounded-md border border-border/60 bg-background/70 p-3 text-xs text-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          {message.isMacro && !message.isMine ? `Expanded ${quoteRequest.type}` : `${quoteRequest.type} workflow`}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            {requestStatusLabel}
          </span>
          {quoteRequest.responseDeadline && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", countdownClassName)}>
              {countdownLabel}
            </span>
          )}
          <span className="rounded-full bg-accent px-2 py-0.5 uppercase tracking-wide text-[10px]">
            {quoteRequest.terms.productCode}
          </span>
        </div>
      </div>

      {message.isMacro && !message.isMine ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><span className="text-muted-foreground">Quantity</span><div className="font-medium">{quoteRequest.terms.quantity}</div></div>
          <div><span className="text-muted-foreground">Quality</span><div className="font-medium">{quoteRequest.terms.quality}</div></div>
          <div><span className="text-muted-foreground">Location</span><div className="font-medium">{quoteRequest.terms.location}</div></div>
          <div><span className="text-muted-foreground">Price basis</span><div className="font-medium">{quoteRequest.terms.priceBasis}</div></div>
          <div><span className="text-muted-foreground">Premium</span><div className="font-medium">{quoteRequest.terms.premium}</div></div>
          {quoteRequest.responseDeadline && <div><span className="text-muted-foreground">Response TTL</span><div className="font-medium">{countdownLabel}</div></div>}
          {quoteRequest.terms.fees && <div><span className="text-muted-foreground">Fees</span><div className="font-medium">{quoteRequest.terms.fees}</div></div>}
          {quoteRequest.terms.vat && <div><span className="text-muted-foreground">VAT / MwSt</span><div className="font-medium">{quoteRequest.terms.vat}</div></div>}
          {quoteRequest.terms.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes</span><div className="font-medium">{quoteRequest.terms.notes}</div></div>}
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">
          {quoteRequest.terms.quantity} {quoteRequest.terms.product} at {quoteRequest.terms.location} on {quoteRequest.terms.priceBasis}.
        </p>
      )}

      <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-3.5 w-3.5 text-primary" />
            <div>
              <p className="font-medium">Quote response</p>
              <p className="text-muted-foreground">
                {latestResponse ? `${latestResponse.responder} ${responseVersionLabel} quoted ${latestResponse.quotedPremium ?? "indicative"}` : "No quote submitted yet"}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            {responseStatusLabel ?? "Pending"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <Handshake className="h-3.5 w-3.5 text-primary" />
            <div>
              <p className="font-medium">Trade deal</p>
              <p className="text-muted-foreground">
                {latestDeal ? `${latestDeal.volume} ${latestDeal.product} with ${latestDeal.counterparty} from ${responseVersionLabel ?? "accepted quote"}` : "No deal booked yet"}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            {dealStatusLabel ?? "Pending"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface QuoteWorkflowActionsProps {
  quoteRequest: QuoteRequest;
  latestResponse?: QuoteResponse;
  latestDeal?: TradeDeal;
  canRespond: boolean;
  canConvert: boolean;
  onRespond?: (requestId: string) => void;
  onConvertToDeal?: (requestId: string, responseId: string) => void;
}

export function QuoteWorkflowActions({ quoteRequest, latestResponse, latestDeal, canRespond, canConvert, onRespond, onConvertToDeal }: Readonly<QuoteWorkflowActionsProps>) {
  return (
    <div className="flex justify-between mt-3 pt-2 border-t border-border/30">
      <Button variant="secondary" size="sm" className="text-xs h-8" disabled={!canRespond || !!latestResponse} onClick={() => onRespond?.(quoteRequest.id)}>
        <ReceiptText className="h-3 w-3 mr-1" />
        {latestResponse ? "Quote Sent" : "Send Quote"}
      </Button>

      <Button variant="outline" size="sm" className="text-xs h-8" disabled={!latestResponse || !!latestDeal || !canConvert} onClick={() => latestResponse && onConvertToDeal?.(quoteRequest.id, latestResponse.id)}>
        <Handshake className="h-3 w-3 mr-1" />
        {latestDeal ? "Deal Booked" : "Book Deal"}
      </Button>
    </div>
  );
}