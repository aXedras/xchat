import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InventoryPosition, InventoryFlow } from "@/types/inventory";
import { inventoryPositions, inventoryFlows } from "@/data/mockInventory";
import { ArrowDownLeft, ArrowUpRight, Package, TrendingDown, TrendingUp } from "lucide-react";

const positionStatusConfig: Record<InventoryPosition["status"], { label: string; className: string }> = {
  available: { label: "Available", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  reserved: { label: "Reserved", className: "bg-amber-100 text-amber-800 border-amber-200" },
  "in-transit": { label: "In transit", className: "bg-blue-100 text-blue-800 border-blue-200" },
  blocked: { label: "Blocked", className: "bg-rose-100 text-rose-800 border-rose-200" },
};

const flowStatusConfig: Record<InventoryFlow["status"], string> = {
  planned: "bg-slate-100 text-slate-700 border-slate-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "in-transit": "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-slate-200 text-slate-600 border-slate-300",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" });
}

function FlowRow({ flow }: { flow: InventoryFlow }) {
  const isInflow = flow.type === "inflow";
  const Icon = isInflow ? ArrowDownLeft : ArrowUpRight;
  const color = isInflow ? "text-emerald-600" : "text-rose-600";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/70 p-3 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">
            {isInflow ? "+" : "−"}{flow.quantity} {flow.unit} {flow.product}
          </p>
          <Badge variant="outline" className={`shrink-0 capitalize ${flowStatusConfig[flow.status]}`}>
            {flow.status}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {flow.source} · {flow.location}
          {flow.counterparty ? ` · ${flow.counterparty}` : ""}
          {" · "}{formatDate(flow.expectedDate)}
        </p>
      </div>
    </div>
  );
}

const InventoryView = () => {
  const planned = inventoryFlows.filter((f) => !f.isHistorical);
  const historical = inventoryFlows.filter((f) => f.isHistorical);

  const totalAvailable = inventoryPositions
    .filter((p) => p.status === "available")
    .reduce((sum, p) => sum + p.quantity, 0);

  return (
    <ScrollArea className="h-full max-h-[28rem] xl:max-h-none">
      <div className="space-y-4 p-4">
        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Inventory</p>
                <CardTitle className="mt-2 text-lg">Current positions</CardTitle>
              </div>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                {totalAvailable.toLocaleString("de-CH")} kg avail.
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inventoryPositions.map((pos) => {
                const status = positionStatusConfig[pos.status];
                return (
                  <div key={pos.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{pos.quantity.toLocaleString("de-CH")} {pos.unit}</span>
                      <span className="text-muted-foreground">{pos.product}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{pos.location}</span>
                      <Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Planned flows
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {planned.length > 0 ? (
              planned.map((flow) => <FlowRow key={flow.id} flow={flow} />)
            ) : (
              <p className="text-sm text-muted-foreground">No planned flows.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Recent movements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {historical.length > 0 ? (
              historical.map((flow) => <FlowRow key={flow.id} flow={flow} />)
            ) : (
              <p className="text-sm text-muted-foreground">No recent movements.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default InventoryView;
