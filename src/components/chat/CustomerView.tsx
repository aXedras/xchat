import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Chat, ComplianceFlag } from "@/types/chat";
import { CustomerTimelineEntry } from "@/types/customer";
import { getCustomerSeed } from "@/data/customerSeed";
import { ArrowDownLeft, ArrowUpRight, MessageSquare, ShieldCheck, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DATE_LOCALES } from "@/i18n";

interface CustomerViewProps {
  chat: Chat;
}

const kycStatusClass: Record<string, string> = {
  onboarded: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "in-review": "bg-amber-100 text-amber-800 border-amber-200",
  "not-onboarded": "bg-slate-100 text-slate-700 border-slate-200",
};

const tradeStatusClassName: Record<string, string> = {
  settled: "bg-emerald-100 text-emerald-800 border-emerald-200",
  booked: "bg-blue-100 text-blue-800 border-blue-200",
  quoted: "bg-amber-100 text-amber-800 border-amber-200",
  cancelled: "bg-slate-200 text-slate-700 border-slate-300",
};

function TimelineEntry({ entry, t, dateLocale }: { entry: CustomerTimelineEntry; t: (key: string) => string; dateLocale: string }) {
  const isTrade = entry.type === "trade";
  const Icon = isTrade ? (entry.direction === "buy" ? ArrowDownLeft : ArrowUpRight) : MessageSquare;
  const iconColor = isTrade
    ? entry.direction === "buy"
      ? "text-emerald-600"
      : "text-blue-600"
    : "text-muted-foreground";

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" });

  const statusLabels: Record<string, string> = {
    settled: t("customer.statusSettled"),
    booked: t("customer.statusBooked"),
    quoted: t("customer.statusQuoted"),
    cancelled: t("customer.statusCancelled"),
  };

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
              {statusLabels[entry.status] ?? entry.status}
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
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALES[i18n.language] ?? "en-GB";
  const seed = getCustomerSeed(chat.counterpartyUserId);

  const kycStatusLabel: Record<string, string> = {
    onboarded: t("customer.kycOnboarded"),
    "in-review": t("customer.kycInReview"),
    "not-onboarded": t("customer.kycNotOnboarded"),
  };

  return (
    <ScrollArea className="h-full max-h-[28rem] xl:max-h-none">
      <div className="space-y-4 p-4">
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t("customer.customer")}</p>
                <CardTitle data-testid="customer-name" className="mt-2 text-lg">
                  {chat.name}
                </CardTitle>
                {chat.companyName && <p className="mt-1 text-sm text-muted-foreground">{chat.companyName}</p>}
              </div>
              {seed && (
                <Badge variant="outline" className={kycStatusClass[seed.kycStatus]}>
                  {kycStatusLabel[seed.kycStatus]}
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
                <p>{t("customer.seedNote")}</p>
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <div className="flex items-start gap-2 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-muted-foreground">
                  {t("customer.emptyNote")}
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              {t("customer.transactionHistory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seed && seed.timeline.length > 0 ? (
              <div className="space-y-2">
                {seed.timeline.map((entry) => (
                  <TimelineEntry key={entry.id} entry={entry} t={t} dateLocale={dateLocale} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("customer.noTransactions")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default CustomerView;
