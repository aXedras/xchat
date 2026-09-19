# Review Findings — Fix Instructions for DeepSeek

Repository: `xchat` on branch `feat/rfq-trading-platform`
Base commit: `e4913b9`
Each fix is a NEW timestamped migration (never edit an applied migration) plus
frontend edits where noted. Run the full gate suite after each fix group:
`npm run supabase:reset && npm run supabase:test && npm run ci:verify && npm run supabase:reset && npm run test:e2e`

---

## C-1 · Fehlende Entitlement-Prüfungen in Quotation-RPCs

**Dateien:** neue Migration `supabase/migrations/20260919010000_fix_entitlement_checks.sql`
**Problem:** `submit_quote_response_v2`, `counter_quote_response_v2`, `withdraw_quote_response`, `decline_quote_invitation` prüfen kein Entitlement — ein Benutzer ohne `RFQ_RESPOND`/`RFQ_COUNTER` kann Quotations einreichen, wenn er eine Invitation-ID kennt.

**Fix:** CREATE OR REPLACE jede der 4 Funktionen. Füge **direkt nach** dem `auth.uid()` NULL-Check und **vor** dem Idempotency-Lock folgende Zeilen ein:

- `submit_quote_response_v2`: `IF NOT public.has_entitlement('RFQ_RESPOND') THEN PERFORM public.raise_business_error('not_authorized'); END IF;`
- `counter_quote_response_v2`: `IF NOT public.has_entitlement('RFQ_COUNTER') THEN PERFORM public.raise_business_error('not_authorized'); END IF;`
- `withdraw_quote_response`: `IF NOT public.has_entitlement('RFQ_RESPOND') THEN PERFORM public.raise_business_error('not_authorized'); END IF;`
- `decline_quote_invitation`: `IF NOT public.has_entitlement('RFQ_RESPOND') THEN PERFORM public.raise_business_error('not_authorized'); END IF;`

**Architektur:** Die gesamte Funktion muss per CREATE OR REPLACE in der neuen Migration wiederholt werden (kopiere den Body aus `20260918030000_quotation_v2.sql` und füge den Check ein). Grants/Revokes müssen am Ende der Migration erneut gesetzt werden.

**Test:** pgTAP-Test hinzufügen (in `supabase/tests/closed_group_messaging.sql`, vor `finish()`):

```sql
-- Eve (org A, keine Rolle) darf keine Quotation einreichen.
-- Erstelle zuerst eine frische RFQ an Eve, dann versuche Eve zu submitten.
-- Verwende die bestehenden _p4_users (slot='eve' hat keine Rolle).
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM _p4_users WHERE slot = 'eve'))::text, true);
SELECT throws_ok(
  $$SELECT public.submit_quote_response_v2(jsonb_build_object(
    'invitationId', gen_random_uuid(),
    'clientResponseId', gen_random_uuid(),
    'responseTerms', jsonb_build_object('schemaVersion', 1, 'commercial', jsonb_build_object('validUntil', (now()+interval '1 day')), 'material', '{}'::jsonb, 'assay', '{}'::jsonb, 'logistics', '{}'::jsonb, 'pricingComponents', jsonb_build_array(jsonb_build_object('componentType','PREMIUM','label','x','calculationMethod','FIXED_AMOUNT','numericValue','1','currencyCode','USD','chargeDirection','PAYABLE_BY_REQUESTER')))
  ))$$,
  'P0001',
  'not_authorized',
  'a user without RFQ_RESPOND cannot submit a quotation'
);
```

Gleicher Test für `counter_quote_response_v2` (mit `RFQ_COUNTER`-Prüfung).
Bump `plan(N)` um die Anzahl neuer Assertions.

**Verifikation:** `npm run supabase:reset && npm run supabase:test` muss grün sein. Eve darf keine Quotation einreichen.

---

## C-2 · `claim_outbox_batch` gibt retried Rows nicht zurück

**Datei:** neue Migration `supabase/migrations/20260919020000_fix_outbox_claim.sql`
**Problem:** Die SELECT-Abfrage filtert auf `attempts = 1`, sodass Outbox-Einträge mit `attempts > 1` (nach manuellem Retry) nie zurückgegeben werden und im Status `claimed` hängen bleiben.

**Fix:** CREATE OR REPLACE `public.claim_outbox_batch`. Ersetze die gesamte Funktion mit einer CTE-basierten Version die die gerade geclaimten IDs tracked:

```sql
CREATE OR REPLACE FUNCTION public.claim_outbox_batch(p_batch_size integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows jsonb;
  v_claimed_ids uuid[];
BEGIN
  WITH to_claim AS (
    SELECT id FROM public.domain_outbox
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.domain_outbox o
    SET status = 'claimed', attempts = attempts + 1, updated_at = now()
    FROM to_claim
    WHERE o.id = to_claim.id
    RETURNING o.id
  )
  SELECT array_agg(id) INTO v_claimed_ids FROM claimed;

  IF v_claimed_ids IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'eventType', o.event_type,
        'eventId', o.event_id,
        'payload', o.payload,
        'recipientUserId', o.recipient_user_id,
        'topic', public.domain_outbox_topic(o.recipient_user_id)
      )
      ORDER BY o.created_at
    ),
    '[]'::jsonb
  ) INTO v_rows
  FROM public.domain_outbox o
  WHERE o.id = ANY(v_claimed_ids);

  RETURN v_rows;
END;
$$;
```

Grants/Revokes am Ende: `GRANT EXECUTE ON FUNCTION public.claim_outbox_batch(integer) TO service_role; REVOKE EXECUTE ON FUNCTION public.claim_outbox_batch(integer) FROM PUBLIC, anon, authenticated;`

**Verifikation:** Manueller Test: füge einen Outbox-Eintrag ein mit `attempts = 2, status = 'pending'` (simuliert einen Reset nach dead_letter). Rufe `claim_outbox_batch(10)` auf. Der Eintrag muss im Ergebnis enthalten sein.

---

## C-3 · `build_deal_snapshot` fehlen Org-Display-Names und User-Names

**Datei:** neue Migration `supabase/migrations/20260919030000_fix_deal_snapshot.sql`
**Problem:** Der Snapshot speichert nur Org-UUIDs, aber keine `legalName`/`displayName` und keine User-Display-Names. Nach Org-Umbenennung zeigt die Trade Confirmation falsche Namen.

**Fix:** CREATE OR REPLACE `public.build_deal_snapshot` mit zusätzlichen JOINs:

```sql
CREATE OR REPLACE FUNCTION public.build_deal_snapshot(
  p_request public.quote_requests,
  p_response public.quote_responses,
  p_requester_org uuid,
  p_counterparty_org uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE  -- FIX H-4: war fälschlich STABLE, nutzt aber now()
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pricing jsonb;
  v_req_org public.organizations;
  v_cp_org public.organizations;
BEGIN
  SELECT * INTO v_req_org FROM public.organizations WHERE id = p_requester_org;
  SELECT * INTO v_cp_org FROM public.organizations WHERE id = p_counterparty_org;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'componentType', c.component_type,
        'label', c.label,
        'calculationMethod', c.calculation_method,
        'numericValue', c.numeric_value,
        'formulaText', c.formula_text,
        'currencyCode', c.currency_code,
        'unitCode', c.unit_code,
        'chargeDirection', c.charge_direction,
        'taxTreatment', c.tax_treatment,
        'minimumAmount', c.minimum_amount,
        'maximumAmount', c.maximum_amount,
        'notes', c.notes
      )
      ORDER BY c.sequence_no
    ),
    '[]'::jsonb
  ) INTO v_pricing
  FROM public.quote_pricing_components c
  WHERE c.response_id = p_response.id;

  RETURN jsonb_build_object(
    'requestId', p_request.id,
    'publicReference', p_request.public_reference,
    'transactionType', p_request.transaction_type,
    'requestTerms', p_request.terms,
    'selectedResponseId', p_response.id,
    'responseTerms', p_response.response_terms,
    'pricingComponents', v_pricing,
    'requesterOrganizationId', p_requester_org,
    'requesterOrganizationLegalName', v_req_org.legal_name,
    'requesterOrganizationDisplayName', v_req_org.display_name,
    'counterpartyOrganizationId', p_counterparty_org,
    'counterpartyOrganizationLegalName', v_cp_org.legal_name,
    'counterpartyOrganizationDisplayName', v_cp_org.display_name,
    'requesterUserId', p_request.owner_user_id,
    'requesterUserDisplayName', public.display_name_for_user(p_request.owner_user_id),
    'counterpartyUserId', p_response.responder_user_id,
    'counterpartyUserDisplayName', public.display_name_for_user(p_response.responder_user_id),
    'requestSchemaVersion', p_request.schema_version,
    'responseSchemaVersion', p_response.schema_version,
    'bookedAt', now()
  );
END;
$$;
```

**Beachte:** Dies ändert auch die Volatility von `STABLE` zu `VOLATILE` (Fix H-4).

**Test:** Der bestehende pgTAP P8-Test prüft `commercial_terms_snapshot->'pricingComponents' IS NOT NULL`. Ergänze eine Assertion:

```sql
SELECT ok(
  (SELECT commercial_terms_snapshot->>'requesterOrganizationDisplayName' IS NOT NULL
   FROM public.trade_deals WHERE id = (SELECT (result->'deal'->>'id')::uuid FROM _p8_deal)),
  'the deal snapshot captures organization display names'
);
```

Bump `plan(N)`.

**Verifikation:** `npm run supabase:reset && npm run supabase:test` grün. Der Snapshot enthält `requesterOrganizationDisplayName`, `counterpartyOrganizationLegalName` etc.

---

## C-4 + C-5 · Operations-RPCs exponieren System-IDs an alle Benutzer

**Datei:** neue Migration `supabase/migrations/20260919040000_fix_operations_auth.sql`
**Problem:** `health_check`, `reconcile_rfq_status`, `reconcile_deal_decision`, `reconcile_document_metadata`, `reconcile_trade_volume` prüfen nur `auth.uid() IS NOT NULL`, kein Admin-Entitlement.

**Fix:** CREATE OR REPLACE jede der 5 Funktionen. Füge direkt nach dem `auth.uid()` NULL-Check ein:

```sql
IF NOT public.is_platform_admin() THEN
  PERFORM public.raise_business_error('not_authorized');
END IF;
```

Grants ändern: `REVOKE EXECUTE ... FROM authenticated` und `GRANT EXECUTE ... TO authenticated` bleibt (die RPCs prüfen intern). Alternativ (strenger): Grants nur für `service_role`. Empfehlung: auf `authenticated` belassen mit internem PLATFORM_ADMIN-Check, da Org-Admins sie sehen dürfen.

**Test:** pgTAP: der bestehende P14-Test nutzt `slot='requester'` (TRADER, kein PLATFORM_ADMIN). Nach dem Fix muss er PLATFORM_ADMIN nutzen, oder throws_ok für TRADER. **Empfehlung:** Ändere die P14-Tests:

1. `requester` (TRADER) → `throws_ok('not_authorized')` für `health_check`.
2. `admin` (PLATFORM_ADMIN) → positive Tests (health ok, reconcile returns data).

Bump `plan(N)`.

**Verifikation:** `npm run supabase:reset && npm run supabase:test` grün. TRADER bekommt `not_authorized`, PLATFORM_ADMIN bekommt Daten.

---

## H-2 · `useTradingContext` Module-Cache nie invalidiert

**Datei:** `src/hooks/useTradingContext.ts`
**Problem:** `cachedContext` ist ein Module-Level-Singleton ohne Invalidierung bei Logout/Rollenwechsel.

**Fix:** Exportiere eine `invalidateTradingContext()`-Funktion und rufe sie bei Logout auf.

```typescript
// src/hooks/useTradingContext.ts
let cachedContext: TradingContext | null = null;
let inFlight: Promise<TradingContext> | null = null;

export function invalidateTradingContext() {
  cachedContext = null;
  inFlight = null;
}
// ... rest bleibt
```

In `src/services/authService.ts`, importiere `invalidateTradingContext` und rufe es in der Logout-Funktion auf:

```typescript
import { invalidateTradingContext } from "@/hooks/useTradingContext";
// in der logout/signOut Funktion:
invalidateTradingContext();
```

**Achtung:** authService.ts liegt in `src/services/`, useTradingContext in `src/hooks/`. Die Abhängigkeit `services → hooks` ist eine Architektur-Inversion. **Alternative (sauberer):** Einen Event-Bus/Callback-Pattern nutzen. authService feuert ein `onLogout`-Event, und useTradingContext subscribt. Oder den Cache an `userId` binden:

```typescript
export function useTradingContext() {
  // ...
  const load = useCallback(async () => {
    // ...
    const result = await inFlight;
    cachedContext = result;
    cachedUserId = result.userId;
    // ...
  }, []);

  useEffect(() => {
    const currentUserId = authService.getAppIdentity()?.userId;
    if (cachedContext === null || cachedUserId !== currentUserId) {
      void load();
    }
  }, [load]);
}
```

**Empfehlung für DeepSeek:** Den userId-basierten Cache implementieren (keine Architektur-Inversion nötig). Import `authService` in hooks ist erlaubt (hooks dürfen services importieren).

**Test:** Manueller Test oder Unit-Test: `invalidateTradingContext()` setzt `cachedContext = null`, nächster `useTradingContext()`-Aufruf fetcht neu.

**Verifikation:** `npm run typecheck && npm run lint` grün. Kein semgrep:arch-Verstoß.

---

## H-3 · `normalize_rfq_terms_v2` gibt Input unverändert zurück

**Datei:** neue Migration, z.B. `20260919050000_fix_normalize_canonicalize.sql`
**Problem:** Die Funktion validiert, normalisiert aber nicht (kein Trimming, keine Key-Sortierung). Der Idempotency-Vergleich `q.terms IS DISTINCT FROM v_terms` kann bei semantisch identischen Payloads fehlschlagen.

**Fix:** Am Ende der Funktion (vor `RETURN p_terms`) einen Canonicalization-Schritt einfügen. Minimaler Ansatz: die Root- und Tab-Objekte rekonstruieren mit nur den erlaubten Keys in sortierter Reihenfolge, trimmed String-Werte:

**Alternative (einfacher, pragmatischer):** Den Idempotency-Vergleich auf einen Hash umstellen statt `IS DISTINCT FROM`:

1. In `create_and_dispatch_quote_request_v2`: speichere `md5(v_terms::text)` als `terms_hash` in einer neuen Spalte (oder vergleiche via `md5(q.terms::text) = md5(v_terms::text)`).

**Empfehlung für DeepSeek:** Den pragmatischen Fix wählen: Ändere den Idempotency-Vergleich in `create_and_dispatch_quote_request_v2` (Zeile 199-204 in rfq_v2.sql) von:

```sql
AND (q.transaction_type IS DISTINCT FROM v_transaction_type
     OR q.terms IS DISTINCT FROM v_terms)
```

zu:

```sql
AND (q.transaction_type IS DISTINCT FROM v_transaction_type
     OR md5(q.terms::text) IS DISTINCT FROM md5(v_terms::text))
```

Dokumentiere in `docs/trading/schema-rules.md`: "Idempotency payload comparison uses md5 hash of the canonical JSON; the client canonicalizer (`src/schemas/canonicalizer.ts`) must be applied before sending."

**Verifikation:** Bestehende pgTAP-Idempotency-Tests müssen weiterhin grün sein. Ergänze einen Test mit semantisch identischem aber syntaktisch unterschiedlichem Payload (z.B. andere Key-Reihenfolge) → muss als Replay erkannt werden (md5 gleich, da jsonb Key-Reihenfolge ignoriert). **Achtung:** PostgreSQL jsonb normalisiert Keys! `'{"b":1,"a":2}'::jsonb = '{"a":2,"b":1}'::jsonb` ist `true`, und `md5(...)` ist auch gleich. Also funktioniert der Hash-Vergleich korrekt mit jsonb. Der Fix ist damit minimal.

---

## H-5 · `quote_responses.status` fehlen `accepted`/`rejected`/`expired`

**Datei:** neue Migration
**Problem:** Gebuchte Responses bleiben im Status `submitted`/`countered`. Die State Machine ist unvollständig.

**Fix:** In einer neuen Migration:

1. Status-Constraint erweitern: `ALTER TABLE public.quote_responses DROP CONSTRAINT quote_responses_status_check; ALTER TABLE public.quote_responses ADD CONSTRAINT quote_responses_status_check CHECK (status IN ('submitted','countered','superseded','withdrawn','accepted','rejected','expired'));`
2. In `book_quote_response_v2` (CREATE OR REPLACE), nach dem INSERT in `quote_response_decisions`, den Response-Status auf `accepted` setzen: `UPDATE public.quote_responses SET status = 'accepted' WHERE id = v_response_id;`
3. In `reject_quote_response_v2`, den Response-Status auf `rejected` setzen: `UPDATE public.quote_responses SET status = 'rejected' WHERE id = v_response_id;`

**Achtung:** Der Immutability-Trigger `prevent_quote_response_v2_mutation` erlaubt Status-Änderungen (nur content-Änderungen sind blockiert). Also funktioniert das UPDATE.

**Test:** Nach dem P8-Deal-Booking: `SELECT is((SELECT status FROM public.quote_responses WHERE id = ...), 'accepted', 'booked response is marked accepted');`

---

## H-6 · `admin_assign_user_role` erlaubt Duplikat-Rollen

**Datei:** neue Migration
**Fix:** Vor dem INSERT in `admin_assign_user_role` prüfen:

```sql
IF EXISTS (
  SELECT 1 FROM public.user_platform_roles
  WHERE user_id = p_user_id AND role_code = p_role_code
    AND (organization_id IS NOT DISTINCT FROM p_organization_id)
    AND (valid_until IS NULL OR valid_until > now())
) THEN
  RETURN jsonb_build_object('ok', true, 'userId', p_user_id, 'roleCode', p_role_code, 'alreadyAssigned', true);
END IF;
```

---

## H-7 · CSV-Import validiert `counterpartyOrganizationId` nicht

**Datei:** neue Migration (CREATE OR REPLACE `create_trade_volume_import_batch`)
**Fix:** In der Validierungsschleife nach dem `quantityUnit`-Check:

```sql
ELSIF (v_row->>'counterpartyOrganizationId') IS NOT NULL
      AND (v_row->>'counterpartyOrganizationId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  v_error := 'invalid_counterparty';
```

---

## M-2 · Duplizierter Pricing-Component-Insert-Code

**Datei:** neue Migration
**Fix:** Erstelle eine interne Helper-Funktion:

```sql
CREATE OR REPLACE FUNCTION public.insert_pricing_components(p_response_id uuid, p_terms jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_component jsonb; v_seq int := 0;
BEGIN
  FOR v_component IN SELECT jsonb_array_elements(p_terms->'pricingComponents') LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.quote_pricing_components (response_id, sequence_no, component_type, label, calculation_method, numeric_value, formula_text, currency_code, unit_code, charge_direction, tax_treatment, minimum_amount, maximum_amount, notes)
    VALUES (p_response_id, v_seq, v_component->>'componentType', v_component->>'label', v_component->>'calculationMethod', NULLIF(v_component->>'numericValue','')::numeric, NULLIF(v_component->>'formulaText',''), NULLIF(v_component->>'currencyCode',''), NULLIF(v_component->>'unitCode',''), v_component->>'chargeDirection', v_component->>'taxTreatment', NULLIF(v_component->>'minimumAmount','')::numeric, NULLIF(v_component->>'maximumAmount','')::numeric, NULLIF(v_component->>'notes',''));
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.insert_pricing_components(uuid, jsonb) FROM PUBLIC, anon, authenticated;
```

Dann in `submit_quote_response_v2` und `counter_quote_response_v2` den Loop durch `PERFORM public.insert_pricing_components(v_response_id, v_terms);` ersetzen.

---

## M-3 · `list_trading_events_since` LIMIT an falscher Stelle

**Datei:** neue Migration
**Fix:** CREATE OR REPLACE `list_trading_events_since`. Das `LIMIT p_limit` muss auf die äußere Abfrage verschoben werden (auf das `SELECT jsonb_agg(obj ...) FROM (...UNION ALL...) t`), NICHT im dritten UNION-Zweig.

---

## M-4 · `mark_quote_invitation_viewed` sperrt unnötig `quote_requests`

**Datei:** neue Migration
**Fix:** CREATE OR REPLACE `mark_quote_invitation_viewed`. Entferne `SELECT * INTO v_request FROM public.quote_requests WHERE id = v_invitation.request_id FOR UPDATE;` (Zeile 876). Die Request-Row wird nicht verändert; nur die Invitation-Row muss gesperrt sein (was bereits geschieht).

---

## M-5 · `cancel_quote_request` Invitation-Update ohne Row-Lock

**Datei:** neue Migration
**Fix:** In `cancel_quote_request`, ändere das Invitation-UPDATE zu:

```sql
UPDATE public.quote_request_invitations
SET status = 'closed', closed_at = now(), close_reason = 'cancelled'
WHERE request_id = p_request_id
  AND status NOT IN ('responded', 'declined', 'closed');
```

Dies verhindert, dass eine gerade responded/declined Invitation überschrieben wird. Alternative: vor dem UPDATE ein `SELECT ... FOR UPDATE` auf die Invitations.

---

## M-6 · Document-Worker hardcoded `versionNo = 1`

**Datei:** `document-worker/src/worker.ts`
**Fix:** Die `complete_document_generation_job`-RPC berechnet die korrekte `version_no` und gibt sie zurück (`versionNo` im Ergebnis-JSON). Der Worker muss:

1. Das Ergebnis der `complete`-RPC auswerten.
2. Oder den Storage-Pfad serverseitig generieren (in der complete-RPC).

Empfehlung: In `complete_document_generation_job`, den Storage-Pfad als Parameter entgegennehmen, ABER den Worker so ändern, dass er die Version NACH dem Aufruf von `complete` aus der Response liest und den Pfad VORHER mit einer provisorischen Namenskonvention erstellt (z.B. `deal/{docId}/pending.pdf`), dann per `complete`-RPC finalisiert.

**Pragmatischer Fix:** Den Storage-Pfad im Worker so berechnen, dass er den Timestamp statt einer fixen Versionsnummer verwendet:

```typescript
function storagePath(documentId: string): string {
  return `deal/${documentId}/document.pdf`;
}
```

Da jede Version ein neues Dokument ist (der alte wird überschrieben, was bei Supabase Storage okay ist), und die `document_versions`-Row den SHA-256 des spezifischen PDFs enthält, ist ein versionierter Pfad nicht strikt nötig. Dokumentiere die Entscheidung.

---

## M-7 · Alle Worker-Fehler als `transient` klassifiziert

**Datei:** `document-worker/src/worker.ts`
**Fix:** Erweitere `classifyError`:

```typescript
function classifyError(error: unknown): { code: string; transient: boolean } {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT|typst unavailable|command not found/i.test(message)) {
    return { code: "typst_unavailable", transient: true };
  }
  if (/template.*not found|no such file|EACCES/i.test(message)) {
    return { code: "template_error", transient: false };
  }
  if (/invalid.*pdf|magic bytes/i.test(message)) {
    return { code: "render_validation_failed", transient: false };
  }
  if (/storage.*upload|bucket/i.test(message)) {
    return { code: "storage_upload_failed", transient: true };
  }
  return { code: "render_failed", transient: true };
}
```

---

## M-8 · Zod-Schema erlaubt leeres `pricingComponents[]`

**Datei:** `src/schemas/quotation/common.ts`, Zeile 142
**Fix:** Ändere `z.array(pricingComponent).max(100)` zu `z.array(pricingComponent).min(1).max(100)`.

**Test:** In `src/schemas/schemas.test.ts`, füge einen Test hinzu:

```typescript
it("rejects a quotation without pricing components", () => {
  const fixture = quotationFixture();
  (fixture as Record<string, unknown>).pricingComponents = [];
  expect(quotationMacroSchemas.SELL_DORE.safeParse(fixture).success).toBe(
    false,
  );
});
```

---

## M-9 · Seed aktiviert nur `transactionRfqV2`, nicht `tradingOrganizationsV2`

**Datei:** `supabase/seed.sql`
**Fix:** Ergänze nach dem bestehenden UPDATE:

```sql
UPDATE public.feature_flags SET enabled = true WHERE key = 'tradingOrganizationsV2';
```

**Verifikation:** Nach `supabase:reset` + Login als Alice → "Start New Conversation" zeigt Organisationen neben den Teilnehmern (Mine A, Refinery B, etc.).

---

## M-10 · `get_my_trading_context` gibt alle Feature-Flags an den Client

**Datei:** neue Migration
**Fix:** Ergänze eine `client_visible boolean NOT NULL DEFAULT true`-Spalte auf `feature_flags`:

```sql
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT true;
```

In `get_my_trading_context`, ändere die Flag-Abfrage:

```sql
SELECT COALESCE(
  jsonb_object_agg(ff.key, ff.enabled),
  '{}'::jsonb
) INTO v_flags
FROM public.feature_flags ff
WHERE ff.client_visible = true;
```

---

## L-1 · `build_deal_snapshot` als `GRANT EXECUTE TO authenticated` exponiert

**Fix:** Wird durch C-3 Migration behoben — in der neuen Migration die Grants anpassen:

```sql
REVOKE ALL ON FUNCTION public.build_deal_snapshot(...) FROM PUBLIC, anon, authenticated;
```

---

## L-2 · Mischung `clock_timestamp()` / `now()` in RPCs

**Empfehlung:** Konsistent `clock_timestamp()` für alle Deadline-/Expiry-Vergleiche verwenden (Echtzeit), `now()` für alle `created_at`/`booked_at`-Timestamps (Transaktionszeit). Dokumentiere die Entscheidung in `docs/trading/schema-rules.md` unter einem neuen Abschnitt "Timestamp policy".

---

## L-3 · `rfqRepositoryV2.createAndDispatch` gibt Ergebnis unvalidiert zurück

**Datei:** `src/services/persistence/rfqRepositoryV2.ts`, Zeile ~167
**Fix:** Ergänze eine `parseDispatchResult(data)`-Funktion analog zu `parseRequesterProjection`, die die Felder defensiv extrahiert.

---

## L-4 · `useQuoteResponseV2` teilt `clientResponseIdRef` zwischen submit/counter

**Datei:** `src/hooks/useQuoteResponseV2.ts`
**Fix:** Ersetze den einzelnen `useRef` durch zwei separate Refs:

```typescript
const submitIdRef = useRef<string | null>(null);
const counterIdRef = useRef<string | null>(null);
```

`submit` verwendet `submitIdRef`, `counter` verwendet `counterIdRef`.

---

## L-5 · Fehlender `updated_at` auf `quote_responses`

**Datei:** neue Migration
**Fix:**

```sql
ALTER TABLE public.quote_responses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER update_quote_responses_updated_at
  BEFORE UPDATE ON public.quote_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

---

## Offene Fragen (vom Review — Antworten dokumentieren)

1. **`expectedVersion` (Bauplan §11.3):** Bewusste Release-1-Vereinfachung → dokumentiere in `docs/trading/schema-rules.md`: "Optimistic locking via expectedVersion is deferred to Release 2."
2. **Private Buckets:** Werden via Supabase CLI/Dashboard provisioniert → dokumentiere in `docs/trading/rollout.md` unter "Deployment prerequisites".
3. **Document Tags:** Tags werden vom Document Worker geschrieben (nach Phase 10 Worker-Erweiterung) → dokumentiere als Open Item in `docs/trading/release-notes.md`.
4. **Events in Quote-Mutation-RPCs:** Ergänze `quote_request_events`-Inserts in `submit_quote_response_v2`, `counter_quote_response_v2`, `reject_quote_response_v2` und `book_quote_response_v2` (event_types: `quotation_submitted`, `quotation_countered`, `quotation_rejected`, `deal_booked`). Dies ist ein Teil der C-1-Migration.

---

## Gate nach allen Fixes

```bash
npm run supabase:reset
npm run supabase:test       # alle pgTAP-Tests grün (plan N+neue)
npm run ci:verify           # lint + build + unit + check:schemas + lint:openapi + jscpd + depcruise + semgrep:arch
npm run semgrep:owasp       # 0 Findings
npm run supabase:reset && npm run test:e2e  # 32 Tests grün
```

Erst wenn ALLE Gates grün: lokaler Commit, dann Re-Review anfordern.
