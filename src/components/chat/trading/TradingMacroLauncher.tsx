import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAvailableTransactionTypes } from "@/hooks/useAvailableTransactionTypes";
import { useTradingContext } from "@/hooks/useTradingContext";
import { cn } from "@/lib/utils";

export const DIRECT_MACRO_COMMANDS: Record<string, string> = {
  "refine-return": "REFINE_AND_RETURN",
  "sell-dore": "SELL_DORE",
  "refine-sell": "REFINE_AND_SELL",
  "buy-refined": "BUY_REFINED_METAL",
  "sell-refined": "SELL_REFINED_METAL",
  "fabricate": "FABRICATE_METAL",
  "buy-feedstock": "BUY_FEEDSTOCK",
};

interface TradingMacroLauncherProps {
  onSelect: (transactionType: string) => void;
}

const TradingMacroLauncher = ({ onSelect }: TradingMacroLauncherProps) => {
  const { t } = useTranslation();
  const { types, loading } = useAvailableTransactionTypes();
  const { context } = useTradingContext();

  const available = types.filter((entry) => entry.available);
  const canCreate = context?.entitlements.includes("RFQ_CREATE") ?? false;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{t("rfqV2.macroPickerTitle")}</div>
      {!canCreate && (
        <p className="text-xs text-muted-foreground">{t("rfqV2.macroNotEntitled")}</p>
      )}
      {loading ? (
        <p className="text-xs text-muted-foreground">{t("rfqV2.loadingMacros")}</p>
      ) : available.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("rfqV2.noMacrosAvailable")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {available.map((entry) => (
            <Button
              key={entry.code}
              type="button"
              variant="outline"
              className={cn("justify-between")}
              onClick={() => onSelect(entry.code)}
            >
              <span>{t(`rfqV2.macro.${entry.code}`, { defaultValue: entry.code })}</span>
              <span className="text-xs text-muted-foreground">{entry.code}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradingMacroLauncher;
