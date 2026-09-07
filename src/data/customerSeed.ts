import type { CustomerTimelineEntry } from "../types/customer";
import type { ComplianceFlag } from "../types/chat";

export interface CustomerSeedProfile {
  kycStatus: "onboarded" | "in-review" | "not-onboarded";
  onboardingNote: string;
  complianceFlags: ComplianceFlag[];
  timeline: CustomerTimelineEntry[];
}

const PROFILES: CustomerSeedProfile[] = [
  {
    kycStatus: "onboarded",
    onboardingNote: "Langjährige Handelsbeziehung; LBMA Good Delivery seit 2021 dokumentiert.",
    complianceFlags: [
      { label: "LBMA Chain of Custody", severity: "positive" },
      { label: "KYC abgeschlossen", severity: "positive" },
    ],
    timeline: [
      {
        id: "p0-1",
        date: "2026-03-14T14:30:00Z",
        type: "trade",
        summary: "Verkauf 5x1KG Gold 999.9 @ Zurich AM fixing +0.17%",
        status: "settled",
        product: "Gold",
        quantity: "5 kg",
        direction: "sell",
      },
      {
        id: "p0-2",
        date: "2026-03-10T09:15:00Z",
        type: "chat-summary",
        summary: "Gesprächsthema: Lieferverzögerung Silber Q1 — neue Liefertermine Ende März",
      },
      {
        id: "p0-3",
        date: "2026-03-06T11:00:00Z",
        type: "trade",
        summary: "Anfrage 20x100OZ Silber loco London — quotiert, kein Abschluss",
        status: "quoted",
        product: "Silver",
        quantity: "20x100 oz",
        direction: "sell",
      },
      {
        id: "p0-4",
        date: "2026-02-27T16:45:00Z",
        type: "trade",
        summary: "Kauf 2x1KG Platin LPPM fixing +0.32%",
        status: "settled",
        product: "Platinum",
        quantity: "2 kg",
        direction: "buy",
      },
    ],
  },
  {
    kycStatus: "in-review",
    onboardingNote: "Neukunde; Platin-Supply-Chain-Dokumentation in Prüfung.",
    complianceFlags: [{ label: "Platin-Supply-Chain offen", severity: "warning" }],
    timeline: [
      {
        id: "p1-1",
        date: "2026-03-11T13:00:00Z",
        type: "chat-summary",
        summary: "Anfrage LBMA Chain of Custody Dokumentation — wartet auf Compliance-Freigabe",
      },
      {
        id: "p1-2",
        date: "2026-02-28T15:30:00Z",
        type: "trade",
        summary: "Anfrage 10x1KG Gold LND fixing +0.25% — verloren an Wettbewerber",
        status: "cancelled",
        product: "Gold",
        quantity: "10 kg",
        direction: "sell",
      },
      {
        id: "p1-3",
        date: "2026-02-15T10:00:00Z",
        type: "chat-summary",
        summary: "Kennenlern-Gespräch — Evaluierung neuer Handelspartner für Platin-Supply-Chain",
      },
    ],
  },
  {
    kycStatus: "onboarded",
    onboardingNote: "Aktive Handelsbeziehung; Silber- und Gold-Positionen in Zürich und London.",
    complianceFlags: [
      { label: "Good Delivery", severity: "positive" },
      { label: "FATF compliant", severity: "positive" },
    ],
    timeline: [
      {
        id: "p2-1",
        date: "2026-03-01T08:20:00Z",
        type: "trade",
        summary: "Verkauf 100x100OZ Silber loco Zürich +0.21%",
        status: "booked",
        product: "Silver",
        quantity: "100x100 oz",
        direction: "sell",
      },
      {
        id: "p2-2",
        date: "2026-02-20T14:10:00Z",
        type: "trade",
        summary: "Kauf 3x1KG Gold Zürich fixing +0.15%",
        status: "settled",
        product: "Gold",
        quantity: "3 kg",
        direction: "buy",
      },
      {
        id: "p2-3",
        date: "2026-02-05T09:45:00Z",
        type: "chat-summary",
        summary: "Abstimmung Jahresplan Gold-/Silber-Positionen",
      },
    ],
  },
];

function hashUserId(userId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Returns the deterministic MVP seed profile for a counterparty, keyed by the
 * stable participant user id. The profile is derived from the user id alone,
 * never from a conversation id. A deterministic subset of participants maps to
 * `null`, which the Customer View renders as the empty state.
 */
export function getCustomerSeed(counterpartyUserId: string | undefined): CustomerSeedProfile | null {
  if (!counterpartyUserId) {
    return null;
  }
  const bucket = hashUserId(counterpartyUserId) % (PROFILES.length + 1);
  if (bucket === PROFILES.length) {
    return null;
  }
  const profile = PROFILES[bucket];
  return {
    ...profile,
    timeline: [...profile.timeline].sort(
      (a, b) => Date.parse(b.date) - Date.parse(a.date),
    ),
  };
}
