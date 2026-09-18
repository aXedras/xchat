import config from "@/config/environment";
import { logger } from "@/services/logger";
import { MetalKey, MetalPrice } from "@/types/marketData";

const SUPPLIER = "vwd";

const SYMBOL_TO_METAL: Record<string, MetalKey> = {
  "XAUUSD.FXVWD": "gold",
  "XAGUSD.FXVWD": "silver",
  "XPTUSD.FXVWD": "platinum",
  "XPDUSD.FXVWD": "palladium",
};

interface RawQuote {
  symbol: string;
  currency: string;
  last: number;
  close: number;
  quoteTime: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseQuote(value: unknown): RawQuote | null {
  if (!isRecord(value)) {
    return null;
  }

  const { symbol, currency, last, close, quoteTime } = value;
  if (
    typeof symbol !== "string" ||
    typeof currency !== "string" ||
    typeof last !== "number" ||
    typeof close !== "number" ||
    typeof quoteTime !== "string"
  ) {
    return null;
  }

  return { symbol, currency, last, close, quoteTime };
}

function toMetalPrice(quote: RawQuote): MetalPrice | null {
  const metal = SYMBOL_TO_METAL[quote.symbol];
  if (!metal) {
    return null;
  }

  const changeAbsolute = quote.last - quote.close;
  const changePercent =
    quote.close !== 0 ? (changeAbsolute / quote.close) * 100 : 0;

  return {
    metal,
    symbol: quote.symbol,
    currency: quote.currency,
    last: quote.last,
    close: quote.close,
    changeAbsolute,
    changePercent,
    quoteTime: quote.quoteTime,
  };
}

export async function fetchMetalPrices(
  signal?: AbortSignal,
): Promise<MetalPrice[]> {
  const { baseUrl, symbols } = config.integrations.marketdata;
  const url = `${baseUrl}/api/v1/quotes/latest?supplier=${SUPPLIER}&symbols=${symbols.join(",")}`;

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    logger.error("Metal price ticker: network request failed", { url, error });
    throw error;
  }

  if (!response.ok) {
    const message = `Metal price ticker: unexpected HTTP status ${response.status}`;
    logger.error(message, { url });
    throw new Error(message);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    logger.error("Metal price ticker: failed to parse JSON response", {
      url,
      error,
    });
    throw error;
  }

  if (!Array.isArray(payload)) {
    const message = "Metal price ticker: expected an array of quotes";
    logger.error(message);
    throw new Error(message);
  }

  const quotes = new Map<string, MetalPrice>();
  for (const entry of payload) {
    const quote = parseQuote(entry);
    if (!quote) {
      logger.warn("Metal price ticker: skipping malformed quote entry", {
        entry,
      });
      continue;
    }

    const price = toMetalPrice(quote);
    if (price) {
      quotes.set(price.symbol, price);
    }
  }

  const ordered = symbols
    .map((symbol) => quotes.get(symbol))
    .filter((price): price is MetalPrice => price !== undefined);

  if (ordered.length !== symbols.length) {
    const missing = symbols.filter((symbol) => !quotes.has(symbol));
    const message = `Metal price ticker: missing symbols in response: ${missing.join(", ")}`;
    logger.error(message, { missing });
    throw new Error(message);
  }

  return ordered;
}
