import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CounterpartyDeal, TradeDeal } from "@/types/chat";
import { BadgeCheck, Handshake } from "lucide-react";
import { DealTermsDetails, getDealTermsDetails } from "./DealTermsDetails";

interface LinkedDealCardProps {
  latestDeal?: TradeDeal;
}

export function LinkedDealCard({ latestDeal }: LinkedDealCardProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4 text-primary" />
          Linked deal
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latestDeal ? (
          <div className="rounded-lg border border-border/70 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{latestDeal.volume} {latestDeal.product}</p>
                <p className="text-xs text-muted-foreground">{latestDeal.counterparty} · accepted on quote v{latestDeal.responseVersion}</p>
              </div>
              <Badge variant="secondary" className="capitalize">{latestDeal.status}</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Created {new Date(latestDeal.createdAt).toLocaleString()}</p>
            <div className="mt-3">
              <DealTermsDetails {...getDealTermsDetails(latestDeal.terms)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No deal has been created from the active response yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

interface DealHistoryCardProps {
  deals: CounterpartyDeal[];
  convertedDeals: number;
}

export function DealHistoryCard({ deals, convertedDeals }: DealHistoryCardProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-4 w-4 text-primary" />
            Deals from prior requests
          </CardTitle>
          <Badge variant="outline">{convertedDeals} converted</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {deals.length ? (
          deals.map((deal) => (
            <div key={deal.id} className="rounded-lg border border-border/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{deal.product} • {deal.volume}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{deal.date} • {deal.outcome}</p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  Closed
                </Badge>
              </div>
              <div className="mt-3">
                <DealTermsDetails {...getDealTermsDetails(deal.terms)} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No completed deals recorded from this counterparty's prior asks.</p>
        )}
      </CardContent>
    </Card>
  );
}