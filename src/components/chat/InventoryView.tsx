import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InventoryPosition, InventoryFlow } from "@/types/inventory";
import { inventoryPositions, inventoryFlows } from "@/data/mockInventory";
import { ArrowDownLeft, ArrowUpRight, Package, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DATE_LOCALES } from "@/i18n";

const positionStatusClass: Record<InventoryPosition["status"], string> = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reserved: "bg-amber-100 text-amber-800 border-amber-200",
  "in-transit": "bg-blue-100 text-blue-800 border-blue-200",
  blocked: "bg-rose-100 text-rose-800 border-rose-200",
};

const flowStatusClass: Record<InventoryFlow["status"], string> = {
  planned: "bg-slate-100 text-slate-700 border-slate-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "in-transit": "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-slate-200 text-slate-600 border-slate-300",
};

function FlowRow({
  flow,
  t,
  dateLocale,
}: {
  flow: InventoryFlow;
  t: (key: string) => string;
  dateLocale: string;
}) {
  const isInflow = flow.type === "inflow";
  const Icon = isInflow ? ArrowDownLeft : ArrowUpRight;
  const color = isInflow ? "text-emerald-600" : "text-rose-600";

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" });

  const flowStatusLabel: Record<string, string> = {
    planned: t("inventory.flowPlanned"),
    confirmed: t("inventory.flowConfirmed"),
    "in-transit": t("inventory.flowInTransit"),
    completed: t("inventory.flowCompleted"),
  };

  const sourceLabel: Record<string, string> = {
    purchase: t("inventory.sourcePurchase"),
    sale: t("inventory.sourceSale"),
    production: t("inventory.sourceProduction"),
    reservation: t("inventory.sourceReservation"),
    transfer: t("inventory.sourceTransfer"),
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/70 p-3 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">
            {isInflow ? "+" : "−"}{flow.quantity} {flow.unit} {flow.product}
          </p>
          <Badge variant="outline" className={`shrink-0 capitalize ${flowStatusClass[flow.status]}`}>
            {flowStatusLabel[flow.status] ?? flow.status}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {sourceLabel[flow.source] ?? flow.source} · {flow.location}
          {flow.counterparty ? ` · ${flow.counterparty}` : ""}
          {" · "}{formatDate(flow.expectedDate)}
        </p>
      </div>
    </div>
  );
}

const InventoryView = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALES[i18n.language] ?? "en-GB";
  const planned = inventoryFlows.filter((f) => !f.isHistorical);
  const historical = inventoryFlows.filter((f) => f.isHistorical);

  const totalAvailable = inventoryPositions
    .filter((p) => p.status === "available")
    .reduce((sum, p) => sum + p.quantity, 0);

  const positionStatusLabel: Record<InventoryPosition["status"], string> = {
    available: t("inventory.statusAvailable"),
    reserved: t("inventory.statusReserved"),
    "in-transit": t("inventory.statusInTransit"),
    blocked: t("inventory.statusBlocked"),
  };

  return (
    <ScrollArea className="h-full max-h-[28rem] xl:max-h-none">
      <div className="space-y-4 p-4">
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t("inventory.inventory")}</p>
                <CardTitle className="mt-2 text-lg">{t("inventory.currentPositions")}</CardTitle>
              </div>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                {t("inventory.availBadge", { count: totalAvailable.toLocaleString(dateLocale) })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inventoryPositions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{pos.quantity.toLocaleString(dateLocale)} {pos.unit}</span>
                    <span className="text-muted-foreground">{pos.product}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{pos.location}</span>
                    <Badge variant="outline" className={`text-xs ${positionStatusClass[pos.status]}`}>{positionStatusLabel[pos.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("inventory.plannedFlows")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {planned.length > 0 ? (
              planned.map((flow) => <FlowRow key={flow.id} flow={flow} t={t} dateLocale={dateLocale} />)
            ) : (
              <p className="text-sm text-muted-foreground">{t("inventory.noPlanned")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              {t("inventory.recentMovements")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {historical.length > 0 ? (
              historical.map((flow) => <FlowRow key={flow.id} flow={flow} t={t} dateLocale={dateLocale} />)
            ) : (
              <p className="text-sm text-muted-foreground">{t("inventory.noRecent")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default InventoryView;
