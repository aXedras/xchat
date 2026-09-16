# Bauplan: Laufender Metallpreis-Ticker im Header (v2)

> Temporäres Arbeitsdokument. Wird nach Abschluss der Implementierung entfernt.

## 0. Implementierungsvertrag (verbindlich)

Bei Widerspruch zu späteren Abschnitten gilt dieser Abschnitt.

### Verbindliche Datentypen

```typescript
// src/types/marketData.ts (neue Datei)
export type MetalKey = "gold" | "silver" | "platinum" | "palladium";

export interface MetalPrice {
  metal: MetalKey;
  symbol: string;          // z.B. "XAUUSD.FXVWD", unverändert von der API
  currency: string;        // z.B. "USD"
  last: number;
  close: number;
  changeAbsolute: number;  // last - close, im Service berechnet
  changePercent: number;   // (last - close) / close * 100, im Service berechnet
  quoteTime: string;       // ISO-String, unverändert von der API
}
```

### Verbindliches Symbol-Mapping

| API-Symbol      | `MetalKey`  | Reihenfolge |
|------------------|-------------|-------------|
| `XAUUSD.FXVWD`   | `gold`      | 1           |
| `XAGUSD.FXVWD`   | `silver`    | 2           |
| `XPTUSD.FXVWD`   | `platinum`  | 3           |
| `XPDUSD.FXVWD`   | `palladium` | 4           |

### Verbindliche Funktionssignaturen

```typescript
// src/services/marketDataService.ts
export async function fetchMetalPrices(signal?: AbortSignal): Promise<MetalPrice[]>

// src/hooks/useMetalPrices.ts
export interface UseMetalPricesResult {
  prices: MetalPrice[];
  error: Error | null;
  isLoading: boolean;
}
export function useMetalPrices(): UseMetalPricesResult
```

### Verbote

1. Keine neue Abstraktionsschicht (kein Provider-Interface, Factory, generisches DataSource-Pattern). YAGNI.
2. Kein `any`; API-Response nur über Type Guard in `MetalPrice[]` überführen. Fehlendes Symbol/Feld → `Error`.
3. Kein stiller Fallback auf Fake-/Default-Preise. Bei Fehler: Hook liefert `error`, Komponente rendert `null`.
4. Kein `setInterval` ohne Cleanup; kein `setState` nach Unmount (AbortController/Guard).
5. Keine überlappenden Fetches (laufenden Request vor neuem Fetch abbrechen).
6. Kein hartkodiertes Zahlenformat → `Intl.NumberFormat`, Locale aus aktiver i18n-Sprache (Mapping wie `DATE_LOCALES`).
7. Keine CSS-in-JS; Animation nur über Tailwind/`index.css`-Keyframes.
8. Keine Änderung an `ProductClass` in `src/types/chat.ts` (eigene RFQ-Domäne).
9. Keine neuen Dependencies.
10. `config/environment.ts`-Muster (`readValue`) exakt übernehmen.

## 1. Zusammenfassung

- **Ziel**: Schmale, animierte Laufzeile (rechts → links) im Header mit Spot-Preisen für Gold, Silber, Platin, Palladium in USD/oz. Refresh alle 15 Min + bei Tab-Aktivierung.
- **Betroffen**: Header-UI, neuer Service/Hook, `environment.ts`, i18n, Tailwind, `index.css`, `nginx.conf` (CSP).
- **Hauptrisiko**: CSP blockiert Fetch in Produktion, wenn `connect-src` nicht erweitert wird.
- **Schema/Security/Workflow**: keine Business-Logik; Security-Aspekt ausschließlich CSP.

## 2. Festgestellte Fakten

- API: `GET https://marketdata.axdev.ch/api/v1/quotes/latest?supplier=vwd&symbols=XAUUSD.FXVWD,XAGUSD.FXVWD,XPTUSD.FXVWD,XPDUSD.FXVWD` → Array `{ symbol, name, currency, last, bid, ask, close, quoteTime, ... }`. Kein API-Key.
- CORS erlaubt getestete Origin.
- `nginx.conf:9` — CSP `connect-src` erlaubt nur `'self'`, Supabase, lokale WS. **Muss erweitert werden.**
- `src/components/Header.tsx:55` — `<header className="h-16 ...">`, gerendert in `Dashboard.tsx` + `Profile.tsx`.
- `src/config/environment.ts` — `readValue`-Muster, Vorlage `integrations.bil`.
- `src/i18n/index.ts` — `DATE_LOCALES`-Mapping (`de` → `de-CH`) als Locale-Vorlage.
- `tailwind.config.ts` — `gold`/`silver`/`platinum` vorhanden, `palladium` fehlt.
- `src/index.css` — `@layer components`, keine Marquee-Keyframes.
- `src/main.tsx` — kein `StrictMode`.
- Kein Unit-Test-Framework (nur Playwright e2e); e2e nutzt keine Header-Selektoren.
- `eslint.config.js`: `react-hooks/recommended` aktiv (`exhaustive-deps`).
- `tsconfig.app.json`: `strict: false`, `noImplicitAny: false` (Projekt-Standard lax; dieser Plan verlangt trotzdem explizite Typen).

## 3. Umfang

**In Scope**: `src/types/marketData.ts`, `src/services/marketDataService.ts`, `src/hooks/useMetalPrices.ts`, `src/components/MetalPriceTicker.tsx`, Header-Integration, `environment.ts`, `.env.example`, i18n `header.ticker.*`, `tailwind.config.ts` (`palladium`), `index.css` (Keyframes), `nginx.conf` (CSP).

**Out of Scope**: Caching, WebSocket, Admin-Konfiguration, `ProductClass`/RFQ-Logik.

**Bestätigte Entscheidungen**: Metalle Gold/Silber/Platin/Palladium; Einheit USD/oz; Position zweite Zeile unterhalb Header-Zeile; Delta-Pfeil (▲/▼) + Grün/Rot; Nachkommastellen einheitlich 2.

## 4. Mikro-Schritte

1. **CSP**: `nginx.conf` `connect-src` um `https://marketdata.axdev.ch` erweitern.
2. **Config**: `environment.ts` `integrations.marketdata` (`baseUrl` Default `https://marketdata.axdev.ch`, `symbols` Konstante); `.env.example` ergänzen.
3. **Typen**: `src/types/marketData.ts` exakt nach Abschnitt 0.
4. **Service**: `fetchMetalPrices(signal?)`, Type-Guard, Symbol-Mapping, `changeAbsolute`/`changePercent`, Fehler werfen.
5. **Hook**: sofortiger Fetch + `setInterval(15*60*1000)` + `visibilitychange`; Cleanup (clearInterval, abort, removeEventListener); keine überlappenden Fetches.
6. **i18n**: `header.ticker.gold/silver/platinum/palladium` + `header.ticker.unit` in en/de/fr.
7. **Tailwind/CSS**: `palladium`-Farben; `@keyframes ticker-scroll` (`translateX(0) → -50%`, Inhalt 2x) + `prefers-reduced-motion`.
8. **Komponente**: `MetalPriceTicker.tsx`; bei `error`/leer → `null`; `Intl.NumberFormat`; `aria-live="off"`, `aria-hidden="true"`.
9. **Header**: `<header>` zweizeilig, Ticker als zweite Zeile.

## 5. Nicht-funktionale Anforderungen

- **Performance**: reine CSS-Animation, Polling exakt 15 Min.
- **Resilienz**: `AbortController` beim nächsten Zyklus; kein Retry; nächster Zyklus heilt transient.
- **Security**: kein API-Key; CSP gezielt nur eine Domain erweitern.
- **Nebenläufigkeit**: kein doppelter Fetch bei Seitenwechsel; Cleanup beim Unmount.
- **Barrierefreiheit**: `prefers-reduced-motion`; Ticker dekorativ (`aria-hidden`).
- **i18n**: Namen + Zahlenformat folgen aktiver Sprache.
- **Beobachtbarkeit**: Fehler über `src/services/logger.ts` loggen.
- **Wartbarkeit**: Symbol-Liste und Intervall als benannte Konstanten.
- **Browser**: Ziel `ES2020`; `AbortController`/`Intl.NumberFormat`/CSS-Keyframes ok.

## 6. Validierungsmatrix

- Build: `npm run build`
- Lint/Format: `npm run lint`, `npm run format:check`
- CSP: `npm run docker:build:ci` + Konsole auf CSP-Violations prüfen
- i18n: Sprachwechsel DE/EN/FR
- Motion: DevTools `prefers-reduced-motion` → Animation aus
- Fehlerpfad: Netzwerk offline → Ticker verschwindet, App bleibt funktional
- Nebenläufigkeit: schneller Seitenwechsel ohne "setState on unmounted"-Warning
- e2e: `npm run test:e2e` bleibt grün

## 7. Risiken & Rollback

- CSP-Fix vergessen → Ticker nur lokal, deployed lautlos kaputt. Schritt 1 vor Abnahme.
- API-Ausfall → Ticker blendet sich aus, Fehler geloggt.
- Rollback: additive Änderungen + kleine Edits → `git revert`.

## 8. Approval-Gate

Freigegeben am 16.09.2026. Implementierung startet unmittelbar nach Persistierung dieses Dokuments.
