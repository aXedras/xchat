export interface CustomerTimelineEntry {
  id: string;
  date: string;
  type: "trade" | "chat-summary";
  summary: string;
  details?: string;
  status?: string;
  product?: string;
  quantity?: string;
  direction?: "buy" | "sell";
}
