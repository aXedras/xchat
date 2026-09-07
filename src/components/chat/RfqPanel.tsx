import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteInvitationRecord, QuoteResponseRecord } from "@/types/chat";

interface RfqPanelProps {
  invitation: QuoteInvitationRecord;
  responses: QuoteResponseRecord[];
  isOwner: boolean;
  busy: boolean;
  onLoadResponses: (invitationId: string) => void;
  onSubmitQuote: (invitationId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onCounterQuote: (invitationId: string, parentResponseId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onRejectQuote: (invitationId: string, responseId: string) => Promise<unknown>;
  onBookQuote: (invitationId: string, responseId: string) => Promise<unknown>;
}

const termLabel: Record<string, string> = {
  quantity: "Quantity",
  product: "Product",
  productCode: "Code",
  quality: "Quality",
  location: "Location",
  priceBasis: "Price basis",
  premium: "Premium",
};

const statusClass: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800",
  expired: "bg-slate-200 text-slate-700",
  converted: "bg-violet-100 text-violet-800",
};

const responseStatusLabel: Record<string, string> = {
  submitted: "Submitted",
  countered: "Countered",
};

const decisionLabel: Record<string, string> = {
  accepted: "Accepted",
  rejected: "Rejected",
};

const RfqPanel = ({
  invitation,
  responses,
  isOwner,
  busy,
  onLoadResponses,
  onSubmitQuote,
  onCounterQuote,
  onRejectQuote,
  onBookQuote,
}: RfqPanelProps) => {
  const [premium, setPremium] = useState("");
  const [notes, setNotes] = useState("");
  const [counterTarget, setCounterTarget] = useState<string | null>(null);

  useEffect(() => {
    onLoadResponses(invitation.id);
  }, [invitation.id, onLoadResponses]);

  const terms = invitation.terms ?? {};

  const hasInitialQuote = responses.some((response) => !response.parentResponseId);

  const submitInitial = async () => {
    if (!premium.trim()) return;
    const result = await onSubmitQuote(invitation.id, premium.trim(), notes.trim() || null);
    if (result !== undefined) {
      setPremium("");
      setNotes("");
    }
  };

  const submitCounter = async () => {
    if (!counterTarget || !premium.trim()) return;
    const result = await onCounterQuote(invitation.id, counterTarget, premium.trim(), notes.trim() || null);
    if (result !== undefined) {
      setPremium("");
      setNotes("");
      setCounterTarget(null);
    }
  };

  return (
    <div className="border-t border-border p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">RFQ</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusClass[invitation.effectiveStatus] ?? ""}`}>
          {invitation.effectiveStatus}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(termLabel).map(([key, label]) =>
          terms[key] ? (
            <div key={key}>
              <span className="text-muted-foreground">{label}</span>
              <div className="font-medium">{String(terms[key])}</div>
            </div>
          ) : null,
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Responses</p>
        {responses.length === 0 ? (
          <p className="text-muted-foreground">No responses yet.</p>
        ) : (
          responses.map((response) => (
            <div key={response.id} className="rounded-md border border-border p-2 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  {response.quotedPremium}
                  <span className="ml-2 text-xs text-muted-foreground capitalize">{responseStatusLabel[response.status]}</span>
                  {response.decision && (
                    <span className={`ml-2 text-xs font-medium ${response.decision === "accepted" ? "text-emerald-700" : "text-rose-700"}`}>
                      {decisionLabel[response.decision]}
                    </span>
                  )}
                </div>
                {response.notes && <div className="text-xs text-muted-foreground">{response.notes}</div>}
              </div>
              <div className="flex gap-1">
                {response.allowedActions.includes("counter") && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => setCounterTarget(response.id)}>
                    Counter
                  </Button>
                )}
                {response.allowedActions.includes("reject") && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onRejectQuote(invitation.id, response.id)}>
                    Reject
                  </Button>
                )}
                {response.allowedActions.includes("book") && (
                  <Button size="sm" disabled={busy} onClick={() => onBookQuote(invitation.id, response.id)}>
                    Book Deal
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {invitation.effectiveStatus === "open" && ((!isOwner && !hasInitialQuote) || counterTarget) && (
        <div className="space-y-2 border-t border-border/50 pt-2">
          {counterTarget && (
            <p className="text-xs text-muted-foreground">Countering a response. Enter your premium below.</p>
          )}
          <div className="flex gap-2">
            <Input value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="Premium (e.g. +0.20)" />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
            {counterTarget ? (
              <Button disabled={busy || !premium.trim()} onClick={() => void submitCounter()}>
                Send Counter
              </Button>
            ) : (
              <Button disabled={busy || !premium.trim()} onClick={() => void submitInitial()}>
                Submit Quote
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RfqPanel;
