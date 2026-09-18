
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
import { useTranslation } from "react-i18next";

const macros = [
  {
    macro: "ASK [qty]x[weight][unit] [metal] [quality] [location] [date/fixing] +[premium] | TTL: ... | FEE: ... | VAT: ... | NOTE: ...",
    example: "ASK 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3 | TTL: 10m",
    descriptionKey: "macroHelp.descAsk",
  },
  {
    macro: "RFQ [qty]x[weight][unit] [metal] [quality] [location] [date/fixing] +[premium] | TTL: ... | FEE: ... | VAT: ...",
    example: "RFQ 10x1KG AU LBMA good delivery LND fixing 18.03 +0.3 | TTL: 10m | FEE: 25 bps | VAT: exempt",
    descriptionKey: "macroHelp.descRfq",
  },
  {
    macro: "BID [qty]x[weight][unit] [metal] [quality] [location] [date] +[premium]",
    example: "BID 5x400oz AU LBMA LND fixing 19.03 +0.15",
    descriptionKey: "macroHelp.descBid",
  },
  {
    macro: "OFFER [qty]x[weight][unit] [metal] [quality] [location] [date] +[premium]",
    example: "OFFER 20x1KG AG 999.9 ZRH fixing 20.03 +1.2",
    descriptionKey: "macroHelp.descOffer",
  },
  {
    macro: "Ask Airwaybill for #[number]",
    example: "Ask Airwaybill for #123456",
    descriptionKey: "macroHelp.descAirwaybill",
  },
  {
    macro: "Ask CoO for #[number]",
    example: "Ask CoO for #789012",
    descriptionKey: "macroHelp.descCoO",
  },
  {
    macro: "Ask Analysis for #[number]",
    example: "Ask Analysis for #345678",
    descriptionKey: "macroHelp.descAnalysis",
  },
];

const MacroHelp = () => {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t("macroHelp.title")}</DialogTitle>
          <DialogDescription>
            {t("macroHelp.subtitle")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-sm">
          {t("macroHelp.rfqShortcut")}
        </div>

        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
          <strong>{t("macroHelp.terminology")}</strong> {t("macroHelp.terminologyText")}
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-900 text-sm space-y-1">
          <p><strong>{t("macroHelp.askVsRfq")}</strong> {t("macroHelp.askVsRfqText")}</p>
          <p><strong>{t("macroHelp.ttl")}</strong> {t("macroHelp.ttlText")}</p>
          <p><strong>{t("macroHelp.statusHandling")}</strong> {t("macroHelp.statusHandlingText")}</p>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">{t("macroHelp.macroFormat")}</TableHead>
              <TableHead className="w-[30%]">{t("macroHelp.example")}</TableHead>
              <TableHead className="w-[40%]">{t("macroHelp.description")}</TableHead>
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
                  {t(item.descriptionKey)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="mt-6">
          <h4 className="font-semibold mb-2">{t("macroHelp.metalCodes")}</h4>
          <div className="grid grid-cols-3 gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-accent rounded-md cursor-help">
                    <span className="font-semibold">AU</span> - {t("macroHelp.gold")}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {t("macroHelp.goldEtymology")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-accent rounded-md cursor-help">
                    <span className="font-semibold">AG</span> - {t("macroHelp.silver")}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {t("macroHelp.silverEtymology")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 bg-accent rounded-md cursor-help">
                    <span className="font-semibold">PT</span> - {t("macroHelp.platinum")}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {t("macroHelp.platinumEtymology")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">PD</span> - {t("macroHelp.palladium")}
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">RH</span> - {t("macroHelp.rhodium")}
            </div>
          </div>
          
          <h4 className="font-semibold mt-4 mb-2">{t("macroHelp.locationCodes")}</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">LND</span> - {t("macroHelp.london")}
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">ZRH</span> - {t("macroHelp.zurich")}
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">NYC</span> - {t("macroHelp.newYork")}
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">HKG</span> - {t("macroHelp.hongKong")}
            </div>
            <div className="p-3 bg-accent rounded-md">
              <span className="font-semibold">SGP</span> - {t("macroHelp.singapore")}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MacroHelp;
