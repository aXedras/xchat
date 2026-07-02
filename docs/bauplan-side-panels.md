# Bauplan: Context-Aware Side Panels

## Übersicht

Der ChatWindow bekommt ein tab-basiertes Side Panel (rechts, xl:w-96), das kontextabhängig verschiedene Views anbietet. Die bestehende AskContextPanel-Architektur wird zum Tab in einem übergeordneten Panel-Container.

## Zwei neue Views

### 1. Customer View (Kundenbuch)

**Wann sichtbar:** Immer wenn ein Chat aktiv ist (Default-Tab im normalen Chat-Modus).

**Inhalt:**

- **Counterparty-Profil**: Firma, Kontaktperson, KYC-Status, Onboarding-Notiz, Compliance-Flags
- **Chronologische Transaktionshistorie** (neueste zuerst):
  - **Trade-Transaktionen**: Kauf/Verkauf mit Datum, Produkt, Menge, Preis, Status
  - **Chat-Summaries**: AI-generierte Zusammenfassung pro Konversation/Thema als Event-Eintrag in der Timeline
- Jeder Eintrag hat: Datum, Typ-Icon (Trade vs. Chat), Einzeiler-Summary, optional Detail-Expand

**Datenmodell (Seed/Mock zuerst):**

```typescript
interface CustomerTimelineEntry {
  id: string
  date: string                          // ISO timestamp
  type: 'trade' | 'chat-summary'
  summary: string                       // Einzeiler: "Verkauf 50kg Gold 999.9 @ CHF 62'450/kg" oder "Gesprächsthema: Lieferverzögerung Silber Q3"
  details?: string                      // Optional: erweiterte Info beim Expand
  status?: string                       // Bei Trades: 'booked' | 'settled' | 'cancelled'
  product?: string                      // Bei Trades: Gold, Silber, etc.
  quantity?: string                     // Bei Trades: "50 kg"
  direction?: 'buy' | 'sell'           // Bei Trades: Kauf oder Verkauf aus unserer Sicht
}
```

### 2. Inventory View (Trader Cockpit)

**Wann sichtbar:** Als Tab wenn ein RFQ aktiv ist. User kann zwischen RFQ-Kontext, Inventory und Customer View wechseln.

**Inhalt:**

- **Aktueller Lagerbestand**: Produkt, Menge, Standort, Verfügbarkeitsstatus
- **Geplante Inflows**: Bekannte zukünftige Zugänge (Käufe, Produktion, erwartete Lieferungen)
- **Geplante Outflows**: Bekannte zukünftige Abgänge (Verkäufe, Reservationen, committed Lieferungen)
- **Historische Bewegungen**: Letzte tatsächliche Zu-/Abgänge

**Datenmodell (Seed/Mock zuerst):**

```typescript
interface InventoryPosition {
  id: string
  product: string                       // "Gold 999.9", "Silber 999.0", etc.
  productCode: string                   // "XAU", "XAG", etc.
  quantity: number
  unit: string                          // "kg", "oz", "bars"
  location: string                      // "Zürich", "London", "Hong Kong"
  status: 'available' | 'reserved' | 'in-transit' | 'blocked'
}

interface InventoryFlow {
  id: string
  type: 'inflow' | 'outflow'
  source: 'purchase' | 'sale' | 'production' | 'reservation' | 'transfer'
  product: string
  productCode: string
  quantity: number
  unit: string
  location: string
  expectedDate: string                  // ISO timestamp
  counterparty?: string                 // Käufer/Verkäufer falls bekannt
  status: 'planned' | 'confirmed' | 'in-transit' | 'completed'
  isHistorical: boolean                 // true = bereits passiert, false = geplant
}
```

## Side Panel Architektur

### Tab-Struktur

```
SidePanel (xl:w-96, border-l)
├── TabBar
│   ├── [Customer]    ← Immer sichtbar
│   ├── [RFQ Context] ← Nur wenn aktiver RFQ
│   └── [Inventory]   ← Nur wenn aktiver RFQ
├── TabContent
│   ├── CustomerView          (bestehendes CounterpartyInsight erweitert)
│   ├── AskContextPanel       (bestehend, wird Tab)
│   └── InventoryView         (neu)
```

### Kontextverhalten

| Chat-Zustand | Verfügbare Tabs | Default-Tab |
|---|---|---|
| Normaler Chat | Customer | Customer |
| Aktiver RFQ | Customer, RFQ Context, Inventory | RFQ Context |

### Responsive Verhalten

- **Desktop (xl+):** Side Panel rechts neben Messages, flex-row
- **Mobile:** Panel unterhalb der Messages, max-h-[28rem], scrollbar
- Gleiches Pattern wie bestehendes AskContextPanel

## Umsetzungsschritte

### Phase 1: Side Panel Container + Tabs

1. Neuer `SidePanelContainer` Wrapper mit Tab-Navigation
2. Bestehendes `AskContextPanel` als Tab einbetten (kein Breaking Change)
3. Tab-State Management (welcher Tab aktiv, kontextabhängige Sichtbarkeit)

### Phase 2: Customer View

4. `CustomerView` Komponente mit Counterparty-Profil-Header
5. `CustomerTimeline` Komponente mit chronologischer Liste
6. Seed-Daten-Factory für realistische Kundenbuch-Einträge
7. Integration in SidePanelContainer als erster Tab

### Phase 3: Inventory View

8. `InventoryView` Komponente mit Lagerbestand-Tabelle
9. `InventoryFlows` Komponente für In-/Outflow-Liste (geplant + historisch)
10. Seed-Daten-Factory für realistische Inventory-Positionen und Flows
11. Integration in SidePanelContainer als dritter Tab (nur bei aktivem RFQ)

### Phase 4: AI Chat Summaries (separat)

12. Service für AI-basierte Chat-Zusammenfassungen
13. Integration der generierten Summaries in die Customer Timeline
14. Trigger: Wann wird eine Summary generiert (Chat-Ende, manuell, periodisch?)

## Abhängigkeiten

- **Keine Breaking Changes** an bestehender RFQ-Funktionalität
- **Mock-Daten zuerst**, Supabase-Backend-Integration in späterem Bauplan
- **AI Chat Summaries** sind ein eigenes Thema (LLM-Integration), erstmal Platzhalter/Seeds

## Offene Fragen

- Soll die Customer View auch bei archivierten Chats sichtbar sein?
- Inventory: Granularität der Standorte (Tresor-Level oder Stadt-Level)?
- AI Summaries: Welches LLM, on-demand oder batch, Kosten-Budget?
