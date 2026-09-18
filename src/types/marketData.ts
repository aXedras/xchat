export type MetalKey = "gold" | "silver" | "platinum" | "palladium";

export interface MetalPrice {
  metal: MetalKey;
  symbol: string;
  currency: string;
  last: number;
  close: number;
  changeAbsolute: number;
  changePercent: number;
  quoteTime: string;
}
