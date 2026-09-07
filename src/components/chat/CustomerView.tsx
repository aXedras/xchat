import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Chat, ComplianceFlag } from "@/types/chat";
import { CustomerTimelineEntry } from "@/types/customer";
import { getCustomerSeed } from "@/data/customerSeed";
import { ArrowDownLeft, ArrowUpRight, MessageSquare, ShieldCheck, User } from "lucide-react";

interface CustomerViewProps {
  chat: Chat;
}

const kycStatusConfig: Record<
  "onboarded" | "in-review" | "not-onboarded",
  { label: string; className: string }
> = {
  onboarded: { label: "KYC onboarded", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  "in-review": { label: "KYC in review", className: "bg-amber-100 text-amber-800 border-amber-200" },
  "not-onboarded": { label: "Not onboarded", className: "bg-slate-100 text-slate-700 border-slate-200" },
};

const tradeStatusClassName: Record<string, string> = {
  settled: "bg-emerald-100 text-emerald-800 border-emerald-200",
  booked: "bg-blue-100 text-blue-800 border-blue-200",
  quoted: "bg-amber-100 text-amber-800 border-amber-200",
  cancelled: "bg-slate-200 text-slate-700 border-slate-300",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" });
}

function TimelineEntry({ entry }: { entry: CustomerTimelineEntry }) {
  const isTrade = entry.type === "trade";
  const Icon = isTrade ? (entry.direction === "buy" ? ArrowDownLeft : ArrowUpRight) : MessageSquare;
  const iconColor = isTrade
    ? entry.direction === "buy"
      ? "text-emerald-600"
      : "text-blue-600"
    : "text-muted-foreground";

  return (
    <div className="flex gap-3 rounded-lg border border-border/70 p-3">
      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{entry.summary}</p>
          {entry.status && (
            <Badge
              variant="outline"
              className={`shrink-0 capitalize ${tradeStatusClassName[entry.status] ?? ""}`}
            >
              {entry.status}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.date)}</p>
      </div>
    </div>
  );
}

function ComplianceFlagBadge({ flag }: { flag: ComplianceFlag }) {
  const className =
    flag.severity === "positive"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : flag.severity === "warning"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-rose-100 text-rose-800 border-rose-200";

  return (
    <Badge variant="outline" className={className}>
      {flag.label}
    </Badge>
  );
}

const CustomerView = ({ chat }: CustomerViewProps) => {
  const seed = getCustomerSeed(chat.counterpartyUserId);

  return (
    <ScrollArea className="h-full max-h-[28rem] xl:max-h-none">
      <div className="space-y-4 p-4">
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Customer</p>
                <CardTitle data-testid="customer-name" className="mt-2 text-lg">
                  {chat.name}
                </CardTitle>
                {chat.companyName && <p className="mt-1 text-sm text-muted-foreground">{chat.companyName}</p>}
              </div>
              {seed && (
                <Badge variant="outline" className={kycStatusConfig[seed.kycStatus].className}>
                  {kycStatusConfig[seed.kycStatus].label}
                </Badge>
              )}
            </div>
          </CardHeader>
          {seed ? (
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-muted-foreground">{seed.onboardingNote}</p>
              </div>
              {seed.complianceFlags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {seed.complianceFlags.map((flag) => (
                    <ComplianceFlagBadge key={flag.label} flag={flag} />
                  ))}
                </div>
              )}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>Profil und Historie sind Seed-Daten bis zur Bullion Integrity Ledger-Integration.</p>
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <div className="flex items-start gap-2 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-muted-foreground">
                  Für diese Gegenpartei liegen noch keine Kundendaten vor. KYC und Transaktionshistorie werden mit der
                  Bullion Integrity Ledger-Integration synchronisiert.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              Transaction history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seed && seed.timeline.length > 0 ? (
              <div className="space-y-2">
                {seed.timeline.map((entry) => (
                  <TimelineEntry key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default CustomerView;
