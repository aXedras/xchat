import { AskMacroDetails } from "@/types/chat";

const productMap = {
  AU: { name: "Gold", productClass: "gold" as const },
  AG: { name: "Silver", productClass: "silver" as const },
  PT: { name: "Platinum", productClass: "platinum" as const },
  PD: { name: "Palladium", productClass: "palladium" as const },
};

const locationMap: Record<string, string> = {
  LND: "London",
  LDN: "London",
  LONDON: "London",
  ZRH: "Zurich",
  ZURICH: "Zurich",
  NYC: "New York",
  NY: "New York",
  HKG: "Hong Kong",
  SGP: "Singapore",
};

export function isAskMacro(content: string) {
  return isQuoteRequestMacro(content);
}

export function isQuoteRequestMacro(content: string) {
  const normalized = content.trim().toUpperCase();
  return normalized.startsWith("ASK ") || normalized.startsWith("RFQ ");
}

export function parseMacroDuration(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const durationPattern = /^(\d+)([smhd])$/;
  const match = durationPattern.exec(normalized);
  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 60 * 60 * 24;
    default:
      return undefined;
  }
}

export function getQuoteRequestExpiry(createdAt: string | undefined, ttlSeconds: number | undefined) {
  if (!createdAt || !ttlSeconds) {
    return undefined;
  }

  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) {
    return undefined;
  }

  return createdAtMs + ttlSeconds * 1000;
}

export function formatRemainingTime(milliseconds: number) {
  if (milliseconds <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function getCountdownTone(milliseconds: number | undefined) {
  if (milliseconds === undefined) {
    return "neutral" as const;
  }

  if (milliseconds <= 0) {
    return "expired" as const;
  }

  if (milliseconds <= 60_000) {
    return "critical" as const;
  }

  if (milliseconds <= 5 * 60_000) {
    return "warning" as const;
  }

  return "healthy" as const;
}

export function parseAskMacro(content: string): AskMacroDetails | null {
  if (!isQuoteRequestMacro(content)) {
    return null;
  }

  const tokens = content.trim().split(/\s+/);
  const macroType = (tokens[0]?.toUpperCase() === "RFQ" ? "RFQ" : "ASK") as AskMacroDetails["macroType"];
  const quantity = tokens[1] ?? "N/A";
  const productCode = (tokens[2] ?? "UNK").toUpperCase();
  const productInfo = productMap[productCode as keyof typeof productMap];
  const remainderTokens = tokens.slice(3);

  const taggedSegments: Record<string, string> = {};
  const rawRemainder = remainderTokens.join(" ");
  const taggedPattern = /(TTL|RESP_BY|FEE|FEES|VAT|MWST|NOTES?|NOTE):\s*([^|]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = taggedPattern.exec(rawRemainder)) !== null) {
    taggedSegments[match[1].toUpperCase()] = match[2].trim();
  }

  const cleanedTerms = rawRemainder
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => !/^(TTL|RESP_BY|FEE|FEES|VAT|MWST|NOTES?|NOTE):/i.test(segment))
    .join(" ")
    .trim()
    .split(/\s+/)
    .join(" ")
    .trim();
  const structuralTokens = cleanedTerms.length > 0 ? cleanedTerms.split(/\s+/) : [];
  const terms = cleanedTerms || "No commercial terms provided";

  const fixingIndex = structuralTokens.findIndex((token) => token.toLowerCase() === "fixing");
  const premiumIndex = structuralTokens.findIndex((token) => /^[+-]\d+(?:\.\d+)?%?$/.test(token));
  const locationIndex = structuralTokens.findIndex((token) => locationMap[token.toUpperCase()] !== undefined);

  const qualityEndIndex = [locationIndex, fixingIndex, premiumIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  const quality = qualityEndIndex === undefined
    ? structuralTokens.join(" ") || "Standard spec"
    : structuralTokens.slice(0, qualityEndIndex).join(" ") || "Standard spec";

  const locationToken = locationIndex >= 0 ? structuralTokens[locationIndex].toUpperCase() : "";
  const location = locationToken ? locationMap[locationToken] : "Not specified";

  let priceBasis = "Spot reference not specified";
  if (fixingIndex >= 0) {
    const fixingWindow = structuralTokens.slice(Math.max(0, fixingIndex - 1), Math.min(structuralTokens.length, fixingIndex + 2));
    priceBasis = fixingWindow.join(" ");
  }

  const premium = premiumIndex >= 0 ? structuralTokens[premiumIndex] : "Not specified";
  const ttl = taggedSegments.TTL ?? taggedSegments.RESP_BY;

  return {
    macroType,
    quantity,
    product: productInfo?.name ?? productCode,
    productCode,
    productClass: productInfo?.productClass ?? "other",
    quality,
    location,
    priceBasis,
    premium,
    ttl,
    ttlSeconds: parseMacroDuration(ttl),
    fees: taggedSegments.FEES ?? taggedSegments.FEE,
    vat: taggedSegments.VAT ?? taggedSegments.MWST,
    notes: taggedSegments.NOTES ?? taggedSegments.NOTE,
    terms,
  };
}