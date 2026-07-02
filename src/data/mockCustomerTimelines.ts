import { CustomerTimelineEntry } from "@/types/customer";

export const customerTimelines: Record<string, CustomerTimelineEntry[]> = {
  "1": [
    {
      id: "ct-1-1",
      date: "2026-03-14T14:30:00Z",
      type: "trade",
      summary: "Verkauf 5x1KG Gold 999.9 @ Zurich AM fixing +0.17%",
      status: "settled",
      product: "Gold",
      quantity: "5 kg",
      direction: "sell",
    },
    {
      id: "ct-1-2",
      date: "2026-03-10T09:15:00Z",
      type: "chat-summary",
      summary: "Gesprächsthema: Lieferverzögerung Silber Q1 — Argor bestätigt neue Liefertermine Ende März",
    },
    {
      id: "ct-1-3",
      date: "2026-03-06T11:00:00Z",
      type: "trade",
      summary: "Anfrage 20x100OZ Silber loco London — quotiert, kein Abschluss",
      status: "quoted",
      product: "Silver",
      quantity: "20x100 oz",
      direction: "sell",
    },
    {
      id: "ct-1-4",
      date: "2026-02-27T16:45:00Z",
      type: "trade",
      summary: "Verkauf 2x1KG Platin LPPM fixing +0.32%",
      status: "settled",
      product: "Platinum",
      quantity: "2 kg",
      direction: "sell",
    },
    {
      id: "ct-1-5",
      date: "2026-02-19T10:20:00Z",
      type: "trade",
      summary: "Anfrage 10x1KG Gold LND fixing +0.25% — verloren an Wettbewerber",
      status: "cancelled",
      product: "Gold",
      quantity: "10 kg",
      direction: "sell",
    },
    {
      id: "ct-1-6",
      date: "2026-02-10T08:30:00Z",
      type: "chat-summary",
      summary: "Erstgespräch Edelmetall-Handelsbeziehung — Argor interessiert an regelmässigen Gold- und Platin-Positionen",
    },
  ],
  "2": [
    {
      id: "ct-2-1",
      date: "2026-03-11T13:00:00Z",
      type: "chat-summary",
      summary: "Anfrage LBMA Chain of Custody Dokumentation — noch offen, wartet auf Compliance-Freigabe",
    },
    {
      id: "ct-2-2",
      date: "2026-02-28T15:30:00Z",
      type: "chat-summary",
      summary: "Kennenlern-Gespräch mit Michael Thompson — PAMP evaluiert neue Handelspartner für Platin-Supply-Chain",
    },
  ],
};
