import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteInvitationRecord, QuoteResponseRecord } from "@/types/chat";
import { useTranslation } from "react-i18next";
import QuotationComposer from "@/components/chat/trading/QuotationComposer";
import { useQuoteResponseV2 } from "@/hooks/useQuoteResponseV2";
import { QuotationTermsV2 } from "@/schemas";

interface RfqPanelProps {
  invitation: QuoteInvitationRecord;
  responses: QuoteResponseRecord[];
  isOwner: boolean;
  busy: boolean;
  className?: string;
  onLoadResponses: (invitationId: string) => void;
  onSubmitQuote: (invitationId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onCounterQuote: (invitationId: string, parentResponseId: string, premium: string, notes?: string | null) => Promise<unknown>;
  onRejectQuote: (invitationId: string, responseId: string) => Promise<unknown>;
  onBookQuote: (invitationId: string, responseId: string) => Promise<unknown>;
}

const statusClass: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800",
  expired: "bg-slate-200 text-slate-700",
  converted: "bg-violet-100 text-violet-800",
};

const RfqPanel = ({
  invitation,
  responses,
  isOwner,
  busy,
  className,
  onLoadResponses,
  onSubmitQuote,
  onCounterQuote,
  onRejectQuote,
  onBookQuote,
}: RfqPanelProps) => {
  const { t } = useTranslation();
  const [premium, setPremium] = useState("");
  const [notes, setNotes] = useState("");
  const [counterTarget, setCounterTarget] = useState<string | null>(null);
  const { submit: submitV2, counter: counterV2, sending: sendingV2 } = useQuoteResponseV2();

  const termLabel: Record<string, string> = {
    quantity: t("rfq.quantity"),
    product: t("rfq.product"),
    productCode: t("rfq.productCode"),
    quality: t("rfq.quality"),
    location: t("rfq.location"),
    priceBasis: t("rfq.priceBasis"),
    premium: t("rfq.premium"),
  };

  const responseStatusLabel: Record<string, string> = {
    submitted: t("rfq.submitted"),
    countered: t("rfq.countered"),
  };

  const decisionLabel: Record<string, string> = {
    accepted: t("rfq.accepted"),
    rejected: t("rfq.rejected"),
  };

  const effectiveStatusLabel: Record<string, string> = {
    open: t("rfq.statusOpen"),
    expired: t("rfq.statusExpired"),
    converted: t("rfq.statusConverted"),
  };

  useEffect(() => {
    onLoadResponses(invitation.id);
  }, [invitation.id, onLoadResponses]);

  const terms = invitation.terms ?? {};
  const isV2 =
    typeof terms.schemaVersion === "number" && terms.schemaVersion >= 1;
  const v2TransactionType = isV2
    ? (terms.commercial as Record<string, unknown> | undefined)?.transactionType
    : undefined;

  const hasInitialQuote = responses.some((response) => !response.parentResponseId);

  const submitV2Quotation = async (quotation: QuotationTermsV2) => {
    try {
      if (counterTarget) {
        await counterV2(counterTarget, quotation);
        setCounterTarget(null);
      } else {
        await submitV2(invitation.id, quotation);
      }
      onLoadResponses(invitation.id);
    } catch {
      // The composer surfaces validation errors; transport errors are non-fatal here.
    }
  };

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
    <div className={className ?? "border-t border-border p-4 space-y-3 text-sm"}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">RFQ</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusClass[invitation.effectiveStatus] ?? ""}`}>
          {effectiveStatusLabel[invitation.effectiveStatus] ?? invitation.effectiveStatus}
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
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("rfq.responses")}</p>
        {responses.length === 0 ? (
          <p className="text-muted-foreground">{t("rfq.noResponses")}</p>
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
                    {t("rfq.counter")}
                  </Button>
                )}
                {response.allowedActions.includes("reject") && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onRejectQuote(invitation.id, response.id)}>
                    {t("rfq.reject")}
                  </Button>
                )}
                {response.allowedActions.includes("book") && (
                  <Button size="sm" disabled={busy} onClick={() => onBookQuote(invitation.id, response.id)}>
                    {t("rfq.bookDeal")}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isV2 &&
        v2TransactionType &&
        invitation.effectiveStatus === "open" &&
        (!isOwner || counterTarget) && (
          <div className="border-t border-border/50 pt-2">
            <QuotationComposer
              transactionType={String(v2TransactionType)}
              disabled={busy || sendingV2}
              onSubmit={(quotation) => void submitV2Quotation(quotation)}
            />
          </div>
        )}

      {!isV2 &&
        invitation.effectiveStatus === "open" &&
        ((!isOwner && !hasInitialQuote) || counterTarget) && (
        <div className="space-y-2 border-t border-border/50 pt-2">
          {counterTarget && (
            <p className="text-xs text-muted-foreground">{t("rfq.counteringNote")}</p>
          )}
          <div className="flex gap-2">
            <Input value={premium} onChange={(e) => setPremium(e.target.value)} placeholder={t("rfq.premiumPlaceholder")} />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("rfq.notesPlaceholder")} />
            {counterTarget ? (
              <Button disabled={busy || !premium.trim()} onClick={() => void submitCounter()}>
                {t("rfq.sendCounter")}
              </Button>
            ) : (
              <Button disabled={busy || !premium.trim()} onClick={() => void submitInitial()}>
                {t("rfq.submitQuote")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RfqPanel;
