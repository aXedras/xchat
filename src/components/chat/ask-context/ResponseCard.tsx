import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteResponse } from "@/types/chat";
import { ReceiptText } from "lucide-react";

interface ResponseCardProps {
  responses: QuoteResponse[];
}

const responseStatusClassName: Record<QuoteResponse["status"], string> = {
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  countered: "bg-amber-100 text-amber-800 border-amber-200",
  accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  withdrawn: "bg-slate-100 text-slate-700 border-slate-200",
  expired: "bg-slate-100 text-slate-700 border-slate-200",
};

const responseStatusLabel: Record<QuoteResponse["status"], string> = {
  submitted: "Submitted",
  countered: "Countered",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export function ResponseCard({ responses }: ResponseCardProps) {
  const latestResponse = responses.at(-1);

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptText className="h-4 w-4 text-primary" />
          Current response
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latestResponse ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/70 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{latestResponse.responder} · v{latestResponse.version}</p>
                  <p className="text-xs text-muted-foreground">{new Date(latestResponse.createdAt).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className={responseStatusClassName[latestResponse.status]}>
                  {responseStatusLabel[latestResponse.status]}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Quoted premium</p>
                  <p className="mt-1 font-medium">{latestResponse.quotedPremium ?? "Indicative"}</p>
                </div>
                {latestResponse.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="mt-1 font-medium">{latestResponse.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {responses.length > 1 && (
              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Quote history</p>
                <div className="mt-3 space-y-2">
                  {responses.map((response) => (
                    <div key={response.id} className="flex items-start justify-between gap-3 rounded-md border border-border/50 px-3 py-2">
                      <div>
                        <p className="font-medium">Version {response.version} · {response.quotedPremium ?? "Indicative"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(response.createdAt).toLocaleString()}</p>
                        {response.notes && <p className="mt-1 text-xs text-muted-foreground">{response.notes}</p>}
                      </div>
                      <Badge variant="outline" className={responseStatusClassName[response.status]}>
                        {responseStatusLabel[response.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No quote response has been submitted for this request yet.</p>
        )}
      </CardContent>
    </Card>
  );
}