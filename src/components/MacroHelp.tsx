
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const macros = [
  {
    macro: "ASK [qty]x[weight][unit] [metal] [quality] [location] [date/fixing] +[premium] | TTL: ... | FEE: ... | VAT: ... | NOTE: ...",
    example: "ASK 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3 | TTL: 10m",
    description: "General buy-side inquiry asking a counterparty to quote. TTL is optional when the request can stay open-ended."
  },
  {
    macro: "RFQ [qty]x[weight][unit] [metal] [quality] [location] [date/fixing] +[premium] | TTL: ... | FEE: ... | VAT: ...",
    example: "RFQ 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3 | TTL: 10m | FEE: 25 bps | VAT: exempt",
    description: "Formal request-for-quotation. Same payload as ASK, but usually used when a clear response window and commercial discipline are required."
  },
  {
    macro: "BID [qty]x[weight][unit] [metal] [quality] [location] [date] +[premium]",
    example: "BID 5x400oz AU LBMA LND fixing 19.03 +0.15",
    description: "Submitting a specific price to buy precious metals (buy-side order)"
  },
  {
    macro: "OFFER [qty]x[weight][unit] [metal] [quality] [location] [date] +[premium]",
    example: "OFFER 20x1KG AG 999.9 ZRH fixing 20.03 +1.2",
    description: "Submitting a specific price to sell precious metals (sell-side order)"
  },
  {
    macro: "Ask Airwaybill for #[number]",
    example: "Ask Airwaybill for #123456",
    description: "Request shipping documentation for specific order"
  },
  {
    macro: "Ask CoO for #[number]",
    example: "Ask CoO for #789012",
    description: "Request Certificate of Origin for specific order"
  },
  {
    macro: "Ask Analysis for #[number]",
    example: "Ask Analysis for #345678",
    description: "Request material analysis certificate for specific order"
  }
];

const MacroHelp = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Industry Macros Guide</DialogTitle>
          <DialogDescription>
            Use these standardized commands to quickly communicate with industry terminology.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
          <strong>Trading Terminology:</strong> In precious metals trading, <span className="font-semibold">BID</span> represents buying interest, while <span className="font-semibold">OFFER</span> represents selling interest. <span className="font-semibold">ASK</span> and <span className="font-semibold">RFQ</span> both represent quote requests on the buy side, with RFQ as the more explicit commercial wording.
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-900 text-sm space-y-1">
          <p><strong>ASK vs RFQ:</strong> ASK is the looser trader shorthand for "please quote me". RFQ is the formal request-for-quotation variant and should be preferred when the request is time-bound or operationally sensitive.</p>
          <p><strong>TTL:</strong> Use <span className="font-mono">TTL: 10m</span>, <span className="font-mono">TTL: 30s</span> or <span className="font-mono">TTL: 1h</span> to tell the recipient how long they have to respond before the request expires.</p>
          <p><strong>Status handling:</strong> Once the TTL elapses, the quote request moves to <span className="font-semibold">Expired</span>. Expired requests should not be answered as if still active; they need a refresh or a new RFQ/ASK.</p>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Macro Format</TableHead>
              <TableHead className="w-[30%]">Example</TableHead>
              <TableHead className="w-[40%]">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {macros.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-mono text-sm">
                  {item.macro}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {item.example}
                </TableCell>
                <TableCell>
                  {item.description}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="mt-6">
          <h4 className="font-semibold mb-2">Metal Codes</h4>
          <div className="grid grid-cols-3 gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-accent rounded-md cursor-help">
                    <span className="font-semibold">AU</span> - Gold
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  From Latin "Aurum"
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-accent rounded-md cursor-help">
                    <span className="font-semibold">AG</span> - Silver
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  From Latin "Argentum"
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-accent rounded-md cursor-help">
                    <span className="font-semibold">PT</span> - Platinum
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  From Spanish "Platina"
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">PD</span> - Palladium
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">RH</span> - Rhodium
            </div>
          </div>
          
          <h4 className="font-semibold mt-4 mb-2">Location Codes</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">LND</span> - London
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">ZRH</span> - Zurich
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">NYC</span> - New York
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">HKG</span> - Hong Kong
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">SGP</span> - Singapore
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MacroHelp;
