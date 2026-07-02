import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CounterpartyInsight } from "@/types/chat";
import { CustomerTimelineEntry } from "@/types/customer";
import { customerTimelines } from "@/data/mockCustomerTimelines";
import { ArrowDownLeft, ArrowUpRight, MessageSquare, ShieldCheck, User } from "lucide-react";

interface CustomerViewProps {
  chatId: string;
  insight?: CounterpartyInsight;
}

const statusConfig = {
  onboarded: { label: "KYC onboarded", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  "in-review": { label: "KYC in review", className: "bg-amber-100 text-amber-800 border-amber-200" },
  "not-onboarded": { label: "Not onboarded", className: "bg-slate-100 text-slate-700 border-slate-200" },
} as const;

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
  const Icon = isTrade
    ? entry.direction === "buy" ? ArrowDownLeft : ArrowUpRight
    : MessageSquare;
  const iconColor = isTrade
    ? entry.direction === "buy" ? "text-emerald-600" : "text-blue-600"
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
            <Badge variant="outline" className={`shrink-0 capitalize ${tradeStatusClassName[entry.status] ?? ""}`}>
              {entry.status}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.date)}</p>
      </div>
    </div>
  );
}

const CustomerView = ({ chatId, insight }: CustomerViewProps) => {
  const timeline = customerTimelines[chatId] ?? [];
  const status = insight ? statusConfig[insight.kycStatus] : statusConfig["not-onboarded"];

  return (
    <ScrollArea className="h-full max-h-[28rem] xl:max-h-none">
      <div className="space-y-4 p-4">
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Customer</p>
                <CardTitle className="mt-2 text-lg">{insight?.company ?? "Unknown"}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{insight?.counterparty ?? "—"}</p>
              </div>
              <Badge variant="outline" className={status.className}>{status.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{insight?.onboardingNote ?? "No onboarding record available."}</span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {insight?.dealHistory.length ?? 0} deals
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {insight?.requestHistory.length ?? 0} requests
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.length > 0 ? (
              timeline.map((entry) => <TimelineEntry key={entry.id} entry={entry} />)
            ) : (
              <p className="text-sm text-muted-foreground">No history recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default CustomerView;
