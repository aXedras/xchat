import { useTranslation } from "react-i18next";
import { DATE_LOCALES } from "@/i18n";
import { useMetalPrices } from "@/hooks/useMetalPrices";
import { MetalPrice } from "@/types/marketData";

function formatPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const MetalPriceTicker = () => {
  const { t, i18n } = useTranslation();
  const { prices, error } = useMetalPrices();

  if (error !== null || prices.length === 0) {
    return null;
  }

  const locale = DATE_LOCALES[i18n.language] ?? "en-GB";
  const unit = t("header.ticker.unit");

  const renderItem = (price: MetalPrice) => {
    const isUp = price.changeAbsolute > 0;
    const isDown = price.changeAbsolute < 0;
    const arrow = isUp ? "▲" : isDown ? "▼" : "";
    const changeClass = isUp
      ? "text-emerald-400"
      : isDown
        ? "text-rose-400"
        : "text-white/70";

    return (
      <span
        key={price.symbol}
        className="flex shrink-0 items-center gap-2 px-6"
      >
        <span className="font-medium">{t(`header.ticker.${price.metal}`)}</span>
        <span className="tabular-nums">
          {formatPrice(price.last, locale)} {unit}
        </span>
        <span className={`tabular-nums text-xs ${changeClass}`}>
          {arrow}
          {formatPrice(Math.abs(price.changeAbsolute), locale)}
        </span>
      </span>
    );
  };

  const renderSequence = () => (
    <div className="flex shrink-0 items-center">{prices.map(renderItem)}</div>
  );

  return (
    <div
      aria-hidden="true"
      aria-live="off"
      className="overflow-hidden border-t border-white/20 bg-black/60 text-white"
    >
      <div className="ticker-track flex w-max py-1 text-xs">
        {renderSequence()}
        {renderSequence()}
      </div>
    </div>
  );
};

export default MetalPriceTicker;
