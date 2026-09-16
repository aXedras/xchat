# Bauplan: Delete-Chat (Hard-Delete) — TEMPORÄRES ARBEITSDOKUMENT

> Dieses Dokument ist ein temporäres Planungsdokument für die Implementierung des
> "Delete chat"-Menüpunkts. Es wird nach erfolgreichem Abschluss der Implementierung
> gelöscht bzw. nicht dauerhaft in `docs/` gepflegt. Zielgruppe: ein ausführendes
> Modell (DeepSeek V4 Pro) ohne Rückfragemöglichkeit während der Umsetzung. Jede
> Vorgabe hier ist bewusst explizit und nicht interpretationsoffen gehalten.

Entschiedener Scope (bereits mit dem Auftraggeber geklärt, **nicht neu verhandelbar**):

1. Hard-Delete: `delete_conversation` löscht die Conversation + Messages **serverseitig,
   persistent, für beide Teilnehmer**.
2. Guard: Ist die Conversation mit RFQ-Responses oder einem gebuchten Trade-Deal
   verknüpft, wird das Löschen **verweigert** (Business-Error), nicht kaskadiert.

---

## 1. Zusammenfassung

- **Ziel:** Der Menüpunkt "Delete chat" (`ChatContextMenu.tsx`) löscht aktuell nichts,
  weil `Dashboard.tsx` keinen `onDeleteChat`-Handler übergibt und es keine
  Backend-Implementierung gibt.
- **Betroffene Subsysteme:** Supabase-Schema/RPC (neue Migration), Persistenz-Layer
  (`messageRepository`, `chatConversationRepository`), State-Hooks (`useActiveChats`,
  `useChatLists`, `useChatState`), UI (`Dashboard.tsx`), i18n (en/de/fr).
- **Hauptrisiko:** Destruktive Operation auf einer bilateralen, gemeinsam genutzten
  Ressource; FK-Kette zu RFQ/Trade-Daten macht eine naive `DELETE` unmöglich (führt zu
  `foreign_key_violation`, wenn nicht explizit behandelt).
- **Schema/Security/Business-Logik betroffen:** Ja, alle drei.

---

## 2. Festgestellte Fakten (Codebasis-Belege)

- `src/pages/Dashboard.tsx:62` übergibt `<ChatList chats={activeChats} selectedChat={selectedChat} onSelectChat={handleChatSelect} />` — **ohne** `onDeleteChat`.
- `src/components/ChatList.tsx:29` defaultet `onDeleteChat = () => {}`.
- `src/components/ChatContextMenu.tsx:59` ruft korrekt `onDelete(chat.id)` auf — die UI-Verdrahtung bis zur Prop-Kette ist intakt, nur der Endpunkt fehlt.
- `src/hooks/useChatLists.tsx` liefert `archivedChats: [] as Chat[]` (Stub, bleibt unangetastet).
- `src/hooks/useActiveChats.tsx` hydriert ausschließlich über `chatConversationRepository.listConversations()`; kein Delete vorhanden.
- `src/services/persistence/chatConversationRepository.ts` und `src/services/persistence/messageRepository.ts` haben keine Delete-Funktion.
- Backend-Tabelle `public.conversations` (`supabase/migrations/20251003010000_tables.sql:620`) ist bilateral (`participant_low_user_id`, `participant_high_user_id`, `UNIQUE`-Paar). RLS ist aktiviert, aber **keine** Policies für `conversations`/`messages` — Zugriff ausschließlich über `SECURITY DEFINER`-RPCs (Muster in `20251003011000_function.sql`, Grants in `20251023093631_grants.sql` bzw. neuestes Muster in `20260916000000_profile_avatar.sql`).
- FK-Kette (alle `ON DELETE RESTRICT`), relevant für einen Conversation-Delete:
  - `messages.conversation_id → conversations.id`
  - `quote_request_invitations.conversation_id → conversations.id`
  - `quote_request_invitations.message_id → messages.id`
  - `quote_responses.invitation_id → quote_request_invitations.id`
  - `quote_response_decisions.response_id → quote_responses.id`
  - `trade_deals.response_id → quote_responses.id`, `trade_deals.request_id → quote_requests.id` (`UNIQUE`)
  - `quote_workflow_idempotency.workflow_message_id → messages.id`, `.response_id → quote_responses.id`, `.deal_id → trade_deals.id`
  - `message_dispatch_recipient.message_id → messages.id`
- **Fehlende Indizes** für die neuen Delete-Queries (Performance-Flaw, wenn nicht behoben):
  - `quote_request_invitations` hat Indizes auf `request_id`, `recipient_user_id` — **kein** Index auf `conversation_id`.
  - `message_dispatch_recipient` hat Index nur auf `dispatch_id` — **kein** Index auf `message_id`.
  - `quote_workflow_idempotency` hat **keinen** Index auf `workflow_message_id` (nur PK `(actor_user_id, client_operation_id)`).
  - `messages(conversation_id, created_at DESC, id DESC)` ist bereits indiziert — hier kein Handlungsbedarf.
  - Quelle: `supabase/migrations/20251016030000_Index.sql`.
- Fehlerkonvention: `raise_business_error(code, details)` (`20251003011000_function.sql:1045`) wirft `RAISE EXCEPTION` mit `ERRCODE='P0001'` und `DETAIL` als JSON `{code, details}`. Frontend `toMessagingError` (`messageRepository.ts:47`) parst `error.details` und liefert `MessagingError.code`.
- `<Toaster />` ist in `src/App.tsx` global gemountet; `useToast()` (`src/hooks/use-toast.ts`) unterstützt `variant: "destructive"`.
- `src/components/ui/alert-dialog.tsx` existiert, ist aber aktuell **ungenutzt** im gesamten Code. `AlertDialogAction` rendert standardmäßig mit `buttonVariants()` (primary) — für destruktive Styling muss `className={buttonVariants({ variant: "destructive" })}` explizit übergeben werden (`src/components/ui/button.tsx:13`).
- **Radix-Detail:** `AlertDialogPrimitive.Action` schließt den Dialog beim Klick automatisch, *bevor* ein async Handler abgeschlossen ist, außer `event.preventDefault()` wird im `onClick` aufgerufen. Das ist zwingend zu beachten (siehe Abschnitt 7.7).
- Test-Infrastruktur: `supabase/tests/closed_group_messaging.sql` ist die **einzige** pgTAP-Datei, beginnt mit `SELECT plan(134);` und endet mit `SELECT * FROM finish();`. Auth-Simulation erfolgt über:
  ```sql
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', json_build_object('sub', <user_id>)::text, true);
  ```
  gefolgt von `RESET ROLE;` am Ende des Blocks. Testnutzer werden direkt in `auth.users` per `INSERT` angelegt (siehe Zeilen ~230–260 der Datei).
- Historie: `deleteChat`/`archiveChat` existierten bereits einmal client-seitig auf Mock-Daten (`git show b9141e1`, `a087d22`), wurden beim Supabase-Persistenz-Refactor (`1794e86`) ersatzlos entfernt.

---

## 3. Scope

### In Scope
1. Neue Migration `supabase/migrations/20260916010000_delete_conversation.sql`:
   - 3 fehlende Indizes (siehe 2.).
   - Funktion `public.delete_conversation(p_conversation_id uuid) RETURNS jsonb`.
   - `GRANT EXECUTE ... TO authenticated` + `REVOKE ... FROM PUBLIC, anon`.
2. `src/services/persistence/messageRepository.ts`: neue Methode `deleteConversation`.
3. `src/services/persistence/chatConversationRepository.ts`: neue Methode `deleteConversation`.
4. `src/hooks/useActiveChats.tsx`: neue Funktion `deleteChat` mit Ground-Truth-Reconciliation (siehe 7.4 — **exakt** wie vorgegeben, keine Variante).
5. `src/hooks/useChatLists.tsx`: `deleteChat` durchreichen.
6. `src/hooks/useChatState.tsx`: `deleteChat`-Handler (Selection/Messages bereinigen, Toast Erfolg/Fehler, Fehlercode-Mapping).
7. `src/pages/Dashboard.tsx`: `onDeleteChat` verdrahten + `AlertDialog`-Bestätigung mit Pending-State.
8. i18n-Ergänzungen in **allen drei** Locale-Dateien (`en.json`, `de.json`, `fr.json`) — identische Key-Menge.
9. pgTAP-Tests in `supabase/tests/closed_group_messaging.sql` (neue Sektion + `plan(...)`-Zahl anpassen).

### Explizit außerhalb des Scopes (nicht anfassen)
- Archive/Restore-Feature (`onArchiveChat`, `onRestoreChat`, `archivedChats`) — bleibt Stub, **keine** Änderung an dessen Verhalten.
- `ChatContextMenu.tsx` und `ChatList.tsx` — deren Prop-Contracts sind bereits ausreichend (`onDeleteChat?: (chatId: string) => void`). **Keine** Änderung an diesen zwei Dateien.
- Löschen/Bereinigen von `quote_requests` und `message_dispatch` — diese Tabellen können durch das Löschen einer Conversation verwaist zurückbleiben (siehe 6.); das ist akzeptiert und **kein** Bug in diesem Scope.
- Jegliche Änderung an `send_messages`, `submit_quote_response`, `counter_quote_response`, `reject_quote_response`, `book_quote_response` oder anderen bestehenden RPCs.
- Neue Spalten wie `archived_at`/`deleted_at` — es handelt sich um echten Hard-Delete, keine Soft-Delete-Spalte.
- Bearbeiten **irgendeiner bestehenden** Migrationsdatei. Alle Schema-Änderungen gehören ausschließlich in die neue Migrationsdatei.

### Geprüfte Annahmen
- Bilateraler Chat ohne Per-User-Visibility-Flag (bestätigt durch Tabellen-DDL).
- RPC-only-Zugriff auf `conversations`/`messages` (bestätigt durch RLS-Migration ohne Policies für diese Tabellen).

---

## 4. Nicht-funktionale Anforderungen & Guardrails (verbindlich)

Diese Anforderungen sind **Abnahmekriterien**, nicht Empfehlungen. Wird eine davon
nicht erfüllt, ist die Implementierung **nicht fertig**, unabhängig davon, ob der
Happy-Path funktioniert.

### 4.1 Sicherheit
- RPC **muss** `SECURITY DEFINER` + `SET search_path = ''` verwenden (Muster aus jeder bestehenden RPC).
- Nicht authentifiziert → `raise_business_error('unauthenticated')`.
- Nicht-Teilnehmer **und** nicht-existierende Conversation-ID **müssen denselben** Fehlercode (`not_authorized`) liefern — kein Unterschied im Fehlerverhalten, um Existenz-Probing einer fremden Conversation-ID zu verhindern (exakt das bestehende Muster aus `list_messages`).
- `GRANT EXECUTE` **ausschließlich** an `authenticated`; explizites `REVOKE ... FROM PUBLIC, anon` in derselben Migration (Pflicht, kein optionaler Zusatz).
- **Kein** direktes `GRANT` auf die Tabellen `conversations`/`messages`/etc. — Zugriff bleibt ausschließlich über die RPC.

### 4.2 Datenintegrität & Nebenläufigkeit
- Die gesamte Löschlogik läuft in **einer** PL/pgSQL-Funktion → durch PostgREST/Postgres bereits atomar (eine Transaktion pro RPC-Call). Es darf **keine** eigene `BEGIN/COMMIT`-Logik im Frontend oder mehrere RPC-Calls für einen Delete-Vorgang geben.
- Die Conversation-Row **muss** per `SELECT ... FOR UPDATE` gelockt werden (exaktes Muster wie `submit_quote_response`, das `quote_requests` per `FOR UPDATE` lockt), um parallele Delete-Aufrufe auf **dieselbe** Conversation zu serialisieren.
- **Bekanntes, akzeptiertes Restrisiko:** Ein paralleler `submit_quote_response`/`counter_quote_response`/`book_quote_response`-Call auf dieselbe Conversation lockt nicht dieselbe Zeile wie `delete_conversation` (er lockt `quote_requests`, nicht `conversations`). Ein Race zwischen Guard-Check und den destruktiven `DELETE`-Statements ist daher **nicht vollständig ausgeschlossen**. Das darf **nicht** durch Änderung anderer RPCs "gelöst" werden (out of scope). Stattdessen: die destruktiven `DELETE`-Statements **müssen** in einen `EXCEPTION WHEN foreign_key_violation`-Block eingebettet werden, der den Fehler in `raise_business_error('conversation_has_activity')` umwandelt (siehe 7.1, wörtlicher Code). Damit bleibt das Verhalten für den Client konsistent (kein roher Postgres-Fehler), und da alles eine Transaktion ist, bleibt bei diesem Fall **nichts** partiell gelöscht.
- **Verboten:** `return` innerhalb eines `finally`-Blocks in TypeScript/JavaScript an den Stellen dieses Plans — das verschluckt eine zuvor geworfene Exception. Siehe 7.4 für die exakt vorgegebene, korrekte Implementierung ohne `try/finally`.
- **Verboten:** Sich auf einen React-State-Wert (z. B. `activeChats` aus einem Hook) unmittelbar nach einem `await`, der denselben State asynchron aktualisiert, als "aktuell" zu verlassen (klassischer Stale-Closure-Bug). Die Ground-Truth-Prüfung nach einem Delete-Fehler **muss** auf dem direkt zurückgegebenen Ergebnis eines frischen `listConversations()`-Aufrufs basieren, nicht auf dem React-State. Siehe 7.4.

### 4.3 Fehlerbehandlung bei mehrdeutigen (ambiguous) Fehlern
- Ein Netzwerk-Timeout/Transportfehler nach erfolgter, aber dem Client nicht bestätigter Löschung darf **nicht** automatisch als Fehler angezeigt werden, wenn die Conversation nach einem Re-Fetch tatsächlich weg ist. Der Client führt nach **jedem** Fehler beim Delete-RPC-Call einen frischen `listConversations()`-Aufruf durch und vergleicht: Ist die Conversation-ID danach noch vorhanden → echter Fehler, Toast anzeigen. Ist sie weg → als Erfolg behandeln (kein Fehler-Toast, UI-State wie bei Erfolg bereinigen).
- Es gibt **keinen** automatischen Retry eines Delete-Aufrufs (destruktive Operation, kein `dispatchId`/`clientActionId`-Idempotenzschlüssel wie bei `send_messages` — bewusst **nicht** eingeführt, siehe YAGNI-Begründung in 4.6).

### 4.4 Performance
- Die drei in 2. genannten fehlenden Indizes **müssen** in derselben Migration angelegt werden (`CREATE INDEX IF NOT EXISTS`), sonst führen die neuen `DELETE ... WHERE conversation_id = ...` bzw. `WHERE message_id IN (...)` bzw. `WHERE workflow_message_id IN (...)` zu Full-Table-Scans.

### 4.5 UI/UX-Konsistenz
- Destruktive Aktion **muss** über eine Bestätigung laufen (`AlertDialog`, kein `window.confirm`).
- Confirm-Button **muss** `variant: "destructive"`-Styling verwenden (`buttonVariants({ variant: "destructive" })`), nicht das Default-Styling von `AlertDialogAction`.
- Sowohl Erfolg als auch Fehler **müssen** über `toast()` angezeigt werden (nicht über `setError`/den bestehenden `error`-State), weil `error` in `Dashboard.tsx` aktuell nur sichtbar ist, wenn **kein** Chat ausgewählt ist (`Dashboard.tsx:100`) — das würde Fehler beim Löschen eines nicht-selektierten Chats unsichtbar machen.
- Während ein Delete-Request für einen bestätigten Chat läuft, **muss** der Confirm-Button deaktiviert werden (`disabled`), um Doppel-Submits durch schnelles Doppelklicken zu verhindern.
- Radix-Detail (Pflicht): Im `onClick`-Handler von `AlertDialogAction` **muss** `event.preventDefault()` aufgerufen werden, sonst schließt Radix den Dialog sofort und der Ladezustand/Fehlerfall kann nicht mehr angezeigt werden, bevor die Async-Operation abgeschlossen ist.

### 4.6 Kein Scope-Creep / YAGNI/KISS
- Kein neuer Idempotenz-Mechanismus (`client_operation_id`/`quote_workflow_idempotency`-Eintrag) für `delete_conversation`. Die in 4.3 beschriebene Re-Fetch-Reconciliation reicht aus, um das Ambiguous-Failure-Problem korrekt zu lösen, ohne zusätzliche Tabellen/State einzuführen.
- Kein Threading eines `disabled`/`isDeleting`-Props durch `ChatList`/`ChatContextMenu` — die Bestätigung läuft komplett modal über den `AlertDialog` in `Dashboard.tsx`; das reicht, weil der Dialog die restliche UI blockiert.
- Keine Wiederverwendung/Erweiterung von `quote_workflow_idempotency` für diesen Zweck.

### 4.7 Internationalisierung
- Alle neuen i18n-Keys **müssen** in `en.json`, `de.json` **und** `fr.json` mit identischer Struktur ergänzt werden (siehe 7.8 für exakte Texte). Fehlt ein Key in einer Sprache, ist die Aufgabe **nicht** abgeschlossen.

### 4.8 Kein Dead Code / keine Doppelimplementierung
- `raise_business_error` wiederverwenden, keine neue Fehler-Hilfsfunktion definieren.
- Keine neue, parallele Toast-/Error-Anzeige-Logik neben der bestehenden `useToast()`/`<Toaster />`-Infrastruktur.

---

## 5. Datenmodell-Auswirkung (Zusammenfassung)

| Tabelle | Aktion bei Delete | Begründung |
|---|---|---|
| `quote_workflow_idempotency` | löschen, wo `workflow_message_id` in Messages der Conversation | verwaiste Referenz vermeiden (defensiv; im Guard-Pfad i. d. R. leer) |
| `quote_request_invitations` | löschen, wo `conversation_id` = Ziel-Conversation | nur unbeantwortete Invitations erreichen diesen Punkt (Guard blockiert sonst) |
| `message_dispatch_recipient` | löschen, wo `message_id` in Messages der Conversation | FK-Restrict auf `messages` |
| `messages` | löschen, wo `conversation_id` = Ziel-Conversation | Kernbestandteil des Chats |
| `conversations` | löschen (Ziel-Row) | Kernobjekt |
| `quote_requests` | **nicht** anfassen | kann von anderen Conversations (Fan-out-RFQ) referenziert sein; darf verwaisen |
| `message_dispatch` | **nicht** anfassen | kann Recipients in anderen Conversations haben; darf verwaisen |
| `quote_responses`, `quote_response_decisions`, `trade_deals` | **nicht** löschen — falls vorhanden, **Guard verweigert das gesamte Delete** | schützt gebuchte Geschäfte/Angebote vor versehentlichem Verlust |

---

## 6. Technisches Design (verbindlicher Referenzcode)

Der folgende Code ist die **verbindliche Referenz**. Abweichungen sind nur zulässig,
wenn sie technisch zwingend sind (z. B. TypeScript-Compiler-Fehler) — Verhalten und
Fehlercodes dürfen sich dabei nicht ändern.

### 6.1 Migration `supabase/migrations/20260916010000_delete_conversation.sql`

```sql
-- ============================================
-- Delete conversation (hard delete) — M11
-- ============================================

-- Missing indexes required by the new DELETE queries below. Without these,
-- every delete_conversation() call performs full table scans on
-- quote_request_invitations, message_dispatch_recipient and
-- quote_workflow_idempotency.
CREATE INDEX IF NOT EXISTS idx_quote_invitations_conversation
  ON public.quote_request_invitations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_recipient_message
  ON public.message_dispatch_recipient(message_id);

CREATE INDEX IF NOT EXISTS idx_quote_workflow_idempotency_workflow_message
  ON public.quote_workflow_idempotency(workflow_message_id);

-- Hard-deletes a bilateral conversation and its messages for both
-- participants. Refuses to delete (raises 'conversation_has_activity') if
-- the conversation carries RFQ responses or a booked trade deal, to protect
-- business/financial records from incidental loss via a chat cleanup
-- action. quote_requests and message_dispatch are intentionally left
-- untouched (may become orphaned; they can be referenced by other
-- conversations via fan-out RFQ sends).
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_conversation public.conversations;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.raise_business_error('unauthenticated');
  END IF;

  -- Lock the conversation row to serialize concurrent delete_conversation
  -- calls targeting the same conversation.
  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  -- Missing row and "not a participant" intentionally raise the identical
  -- error code to avoid leaking whether a conversation id exists at all.
  IF v_conversation IS NULL
     OR (v_conversation.participant_low_user_id <> v_uid
         AND v_conversation.participant_high_user_id <> v_uid) THEN
    PERFORM public.raise_business_error('not_authorized');
  END IF;

  -- Guard: refuse to delete if any RFQ response (and therefore possibly a
  -- booked trade deal) exists for this conversation. Unanswered RFQ
  -- invitations (no response yet) do not block deletion.
  IF EXISTS (
    SELECT 1
    FROM public.quote_request_invitations qri
    JOIN public.quote_responses qr ON qr.invitation_id = qri.id
    WHERE qri.conversation_id = p_conversation_id
  ) THEN
    PERFORM public.raise_business_error('conversation_has_activity');
  END IF;

  BEGIN
    DELETE FROM public.quote_workflow_idempotency
    WHERE workflow_message_id IN (
      SELECT id FROM public.messages WHERE conversation_id = p_conversation_id
    );

    DELETE FROM public.quote_request_invitations
    WHERE conversation_id = p_conversation_id;

    DELETE FROM public.message_dispatch_recipient
    WHERE message_id IN (
      SELECT id FROM public.messages WHERE conversation_id = p_conversation_id
    );

    DELETE FROM public.messages
    WHERE conversation_id = p_conversation_id;

    DELETE FROM public.conversations
    WHERE id = p_conversation_id;
  EXCEPTION WHEN foreign_key_violation THEN
    -- A concurrent RFQ action raced with this delete between the guard
    -- check above and these statements (see NFR 4.2). The whole function
    -- body is one transaction, so nothing here was partially applied;
    -- surface the same clean business error instead of a raw FK error.
    PERFORM public.raise_business_error('conversation_has_activity');
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_conversation(uuid) FROM PUBLIC, anon;
```

**Pflicht-Check:** `raise_business_error` gibt `RETURNS void` zurück und wird per
`PERFORM` aufgerufen (exakt wie in allen bestehenden RPCs, z. B.
`submit_quote_response`). **Nicht** `SELECT public.raise_business_error(...)` verwenden.

### 6.2 `src/services/persistence/messageRepository.ts`

Neue Methode innerhalb des bestehenden `messageRepository`-Objekts ergänzen (vor der
schließenden `};`):

```ts
  async deleteConversation(conversationId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc("delete_conversation", {
      p_conversation_id: conversationId,
    });
    if (error) {
      throw toMessagingError(error);
    }
  },
```

### 6.3 `src/services/persistence/chatConversationRepository.ts`

Neue Methode im `chatConversationRepository`-Objekt ergänzen:

```ts
  async deleteConversation(conversationId: string): Promise<void> {
    await messageRepository.deleteConversation(conversationId);
  },
```

### 6.4 `src/hooks/useActiveChats.tsx`

**Exakt** diese Implementierung verwenden (Begründung: Ground-Truth-Reconciliation
ohne Stale-Closure-Risiko, siehe NFR 4.2/4.3). `hydrate` bleibt unverändert.

```ts
  const deleteChat = useCallback(async (chatId: string): Promise<void> => {
    let deleteError: unknown = null;
    try {
      await chatConversationRepository.deleteConversation(chatId);
    } catch (e) {
      deleteError = e;
    }

    // Always re-fetch after attempting a delete: this is the single source
    // of ground truth used below, independent of React state timing.
    const conversations = await chatConversationRepository.listConversations();
    setActiveChats(conversations);

    const stillExists = conversations.some((chat) => chat.id === chatId);
    if (deleteError && stillExists) {
      // Confirmed real failure: the chat is still present after a fresh
      // refetch.
      throw deleteError;
    }
    // Either the delete succeeded, or it failed ambiguously (e.g. transport
    // error) but the chat is confirmed gone after refetch — treat both as
    // success and do not throw.
  }, []);
```

`deleteChat` in den Rückgabewert des Hooks aufnehmen:

```ts
  return {
    activeChats,
    setActiveChats,
    hydrate,
    deleteChat,
    error,
  };
```

### 6.5 `src/hooks/useChatLists.tsx`

```ts
export function useChatLists() {
  const { activeChats, setActiveChats, hydrate, deleteChat } = useActiveChats();

  return {
    activeChats,
    setActiveChats,
    archivedChats: [] as Chat[],
    refreshChats: hydrate,
    deleteChat,
  };
}
```

### 6.6 `src/hooks/useChatState.tsx`

- Import ergänzen: `import { useToast } from "./use-toast";`
- `MessagingError` ist bereits importiert (Zeile 7) — wiederverwenden, nicht neu importieren.
- `deleteChat` aus `useChatLists()` destrukturieren, umbenannt als `deleteChatPersisted`:

```ts
  const { activeChats, refreshChats, deleteChat: deleteChatPersisted } = useChatLists();
  ...
  const { toast } = useToast();
```

- Neuer Handler (Platzierung: nach `handleChatSelect`, vor `dispatchSend`):

```ts
  const deleteChat = useCallback(
    async (chatId: string) => {
      const chatBeingDeleted = activeChats.find((chat) => chat.id === chatId);
      try {
        await deleteChatPersisted(chatId);
        if (selectedChat?.id === chatId) {
          setSelectedChat(null);
        }
        setMessages((previous) => {
          const next = { ...previous };
          delete next[chatId];
          return next;
        });
        toast({
          title: i18n.t("chat.deleteSuccessTitle"),
          description: i18n.t("chat.deleteSuccessDescription", {
            name: chatBeingDeleted?.name ?? "",
          }),
        });
      } catch (e) {
        const code = e instanceof MessagingError ? e.code : "unknown";
        const descriptionKey =
          code === "conversation_has_activity"
            ? "errors.deleteChatHasActivity"
            : "errors.deleteChat";
        toast({
          variant: "destructive",
          title: i18n.t("errors.deleteChatTitle"),
          description: i18n.t(descriptionKey),
        });
      }
    },
    [activeChats, deleteChatPersisted, selectedChat, setMessages, toast],
  );
```

- In den Rückgabewert des Hooks aufnehmen: `deleteChat,`.

**Wichtig:** `deleteChatPersisted` (aus 6.4) wirft **nur** bei einem bestätigten,
echten Fehler. Der `catch`-Block hier muss daher **nicht** erneut gegen den
Server-State abgleichen — das ist bereits in `useActiveChats.deleteChat` erledigt.
Keine doppelte Reconciliation-Logik einbauen.

### 6.7 `src/pages/Dashboard.tsx`

- Imports ergänzen:
  ```ts
  import { useState } from "react"; // bereits vorhanden — nur prüfen, nicht duplizieren
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
  import { buttonVariants } from "@/components/ui/button";
  import { Chat } from "@/types/chat";
  ```
- `deleteChat` aus `useChatState()` destrukturieren.
- Neuer lokaler State:
  ```ts
  const [pendingDeleteChat, setPendingDeleteChat] = useState<Chat | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  ```
- Neue Handler:
  ```ts
  const handleRequestDeleteChat = (chatId: string) => {
    setPendingDeleteChat(activeChats.find((chat) => chat.id === chatId) ?? null);
  };

  const handleConfirmDeleteChat = async () => {
    if (!pendingDeleteChat) return;
    setIsDeletingChat(true);
    await deleteChat(pendingDeleteChat.id);
    setIsDeletingChat(false);
    setPendingDeleteChat(null);
  };
  ```
- `<ChatList ... onDeleteChat={handleRequestDeleteChat} />` (Erweiterung der bestehenden Props, `onArchiveChat`/`onRestoreChat` **nicht** ergänzen — out of scope).
- Neuer JSX-Block (z. B. direkt nach dem bestehenden `<Dialog>`-Block für `CompanySelector`):
  ```tsx
  <AlertDialog
    open={pendingDeleteChat !== null}
    onOpenChange={(open) => {
      if (!open && !isDeletingChat) setPendingDeleteChat(null);
    }}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("chat.deleteConfirmTitle")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("chat.deleteConfirmDescription", {
            name: pendingDeleteChat?.name ?? "",
          })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isDeletingChat}>
          {t("common.cancel")}
        </AlertDialogCancel>
        <AlertDialogAction
          disabled={isDeletingChat}
          className={buttonVariants({ variant: "destructive" })}
          onClick={(event) => {
            // Radix closes the dialog on click by default; we control
            // closing ourselves once the async delete has settled.
            event.preventDefault();
            void handleConfirmDeleteChat();
          }}
        >
          {t("chat.deleteChat")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  ```

**Nicht vergessen:** `activeChats` ist bereits im Destructuring von `useChatState()`
vorhanden (Zeile 16) — für `handleRequestDeleteChat` wiederverwenden, nicht erneut
laden.

### 6.8 i18n — exakte Ergänzungen

**`src/i18n/locales/en.json`** — in `"chat"` (nach `"deleteChat"`) und `"errors"`
(nach `"performAction"`) ergänzen:

```json
    "deleteConfirmTitle": "Delete chat?",
    "deleteConfirmDescription": "This permanently deletes the conversation with {{name}} for both participants. This cannot be undone.",
    "deleteSuccessTitle": "Chat deleted",
    "deleteSuccessDescription": "\"{{name}}\" has been deleted.",
```
```json
    "deleteChatTitle": "Delete failed",
    "deleteChat": "Unable to delete this chat",
    "deleteChatHasActivity": "This chat has quote responses or a booked deal and cannot be deleted",
```

**`src/i18n/locales/de.json`**:

```json
    "deleteConfirmTitle": "Chat löschen?",
    "deleteConfirmDescription": "Dies löscht die Konversation mit {{name}} endgültig für beide Teilnehmer. Dies kann nicht rückgängig gemacht werden.",
    "deleteSuccessTitle": "Chat gelöscht",
    "deleteSuccessDescription": "\"{{name}}\" wurde gelöscht.",
```
```json
    "deleteChatTitle": "Löschen fehlgeschlagen",
    "deleteChat": "Dieser Chat konnte nicht gelöscht werden",
    "deleteChatHasActivity": "Dieser Chat enthält Angebotsantworten oder ein gebuchtes Geschäft und kann nicht gelöscht werden",
```

**`src/i18n/locales/fr.json`**:

```json
    "deleteConfirmTitle": "Supprimer le chat ?",
    "deleteConfirmDescription": "Cette action supprime définitivement la conversation avec {{name}} pour les deux participants. Cette action est irréversible.",
    "deleteSuccessTitle": "Chat supprimé",
    "deleteSuccessDescription": "« {{name}} » a été supprimé.",
```
```json
    "deleteChatTitle": "Suppression impossible",
    "deleteChat": "Impossible de supprimer ce chat",
    "deleteChatHasActivity": "Ce chat contient des réponses de devis ou une transaction validée et ne peut pas être supprimé",
```

**Achtung Namenskollision:** In `"chat"` existiert bereits der Key `"deleteChat"`
("Delete chat" / Menütext). Die Fehler-Keys oben (`"deleteChat"` unter `"errors"`)
liegen in einem **anderen** Namespace (`errors.deleteChat` vs. `chat.deleteChat`) —
das ist beabsichtigt und kein Konflikt, weil i18next Namespaces trennt. Beim Einfügen
**nicht** versehentlich den bestehenden `chat.deleteChat`-Key überschreiben.

---

## 7. Evolutionäre Mikroschritte

Reihenfolge ist bindend; jeder Schritt setzt den vorherigen voraus.

1. **Migration anlegen** (`6.1`). Abschlusskriterium: Datei existiert, `supabase db reset` (bzw. lokales Reset-Skript) läuft ohne Fehler durch, Funktion ist in `pg_proc` auffindbar.
2. **`messageRepository.deleteConversation`** (`6.2`). Abschlusskriterium: `npm run build` erfolgreich, keine neuen TS-Fehler.
3. **`chatConversationRepository.deleteConversation`** (`6.3`). Abschlusskriterium: `npm run build` erfolgreich.
4. **`useActiveChats.deleteChat`** (`6.4`) — **exakt** wie vorgegeben, kein `try/finally` mit `return`. Abschlusskriterium: `npm run build`, `npm run lint` erfolgreich.
5. **`useChatLists`-Passthrough** (`6.5`). Abschlusskriterium: Build/Lint grün.
6. **`useChatState.deleteChat`** (`6.6`). Abschlusskriterium: Build/Lint grün; `deleteChat` im Rückgabeobjekt vorhanden.
7. **`Dashboard.tsx`-Verdrahtung + AlertDialog** (`6.7`). Abschlusskriterium: Build/Lint grün; manueller Smoke-Test (siehe 9.) grün.
8. **i18n** (`6.8`) in allen drei Dateien. Abschlusskriterium: `npm run format:check` grün, kein fehlender Key in einer der drei Sprachen.
9. **pgTAP-Tests** (siehe Abschnitt 9.1) ergänzen, `plan(134)` auf die neue Gesamtzahl erhöhen. Abschlusskriterium: `npm run supabase:test` grün.

---

## 8. Validierungsmatrix

| Aspekt | Befehl/Vorgehen |
|---|---|
| Build/Typen | `npm run build` |
| Lint | `npm run lint` |
| Format | `npm run format:check` |
| Schema-Reset | `npm run supabase:reset` |
| DB-Tests (pgTAP) | `npm run supabase:test` |
| Duplicate-Code-Check | `npm run jscpd` |
| Architektur-Regeln | `npm run depcruise`, `npm run semgrep:arch` |
| Manueller/E2E-Smoke-Test | siehe Abschnitt 9.2 |

Alle Befehle sind bereits in `package.json` definiert — **keine** neuen Skripte
erfinden.

---

## 9. Testplan

### 9.1 pgTAP (`supabase/tests/closed_group_messaging.sql`)

Neue Sektion **vor** `SELECT * FROM finish();` einfügen. `SELECT plan(134);` am
Dateianfang auf die neue Gesamtzahl der Assertions erhöhen (**Pflicht** — pgTAP
schlägt sonst mit "planned X but ran Y" fehl).

Pflicht-Szenarien (Muster für Testnutzer-Setup und Auth-Simulation exakt aus den
bestehenden Blöcken ab Zeile ~230 der Datei übernehmen — `SET LOCAL ROLE
authenticated;` + `SELECT set_config('request.jwt.claims', json_build_object('sub',
<user_id>)::text, true);` + `RESET ROLE;`):

1. `has_function('public', 'delete_conversation', ARRAY['uuid'], 'delete_conversation(uuid) exists')`.
2. Ohne Session: `delete_conversation` wirft `P0001` / `unauthenticated`.
3. Authentifiziert als Nutzer, der **nicht** Teilnehmer der Conversation ist: wirft `P0001` / `not_authorized`.
4. Mit zufälliger/nicht existierender `conversation_id`: wirft `P0001` / `not_authorized` (identischer Code wie Test 3 — explizit prüfen, dass es **derselbe** Code ist).
5. Teilnehmer löscht eine "einfache" Conversation (nur Standard-Nachrichten, keine RFQ-Response): Aufruf gelingt, `ok(NOT EXISTS(SELECT 1 FROM conversations WHERE id = ...))`, sowie `ok(NOT EXISTS(SELECT 1 FROM messages WHERE conversation_id = ...))`.
6. Conversation mit einer unbeantworteten RFQ-Invitation (kein `quote_responses`-Eintrag): Löschen gelingt; `quote_request_invitations`-Zeile ist weg; zugehöriger `quote_requests`-Eintrag bleibt bestehen (bewusst, siehe Abschnitt 5) — mit `ok(EXISTS(SELECT 1 FROM quote_requests WHERE id = ...))` prüfen.
7. Conversation mit submitted `quote_responses`: `delete_conversation` wirft `P0001` / `conversation_has_activity`; **alle** zugehörigen Zeilen (`conversations`, `messages`, `quote_request_invitations`, `quote_responses`) sind danach unverändert vorhanden (`ok(EXISTS(...))` je Tabelle).
8. Conversation mit gebuchtem `trade_deals`-Eintrag: identischer Guard-Fehler `conversation_has_activity`; Trade-Deal-Zeile bleibt unverändert bestehen.
9. Doppelter Delete-Aufruf (zweimal hintereinander, gleicher Nutzer, gleiche `conversation_id`): erster Call gelingt, zweiter Call wirft `not_authorized` (weil die Row nicht mehr existiert — bewusstes, dokumentiertes Verhalten laut Abschnitt 4.2, kein Bug).

### 9.2 Manueller / E2E-Smoke-Test

Mindestens manuell zu verifizieren (E2E via Playwright optional, nach demselben
Multi-Context-Muster wie `e2e/closed-group-messaging.spec.ts`):

1. Alice löscht einen Chat mit Bob → Chat verschwindet aus Alices Liste **und**, nach Reload, auch aus Bobs Liste.
2. Abbrechen im Bestätigungsdialog löscht **nichts**.
3. Löschen eines Chats mit offener/gebuchter RFQ zeigt den `deleteChatHasActivity`-Fehler-Toast; der Chat bleibt in der Liste.
4. Der zuvor ausgewählte Chat wird nach dem Löschen abgewählt (kein leerer/kaputter `ChatWindow`-Zustand).

---

## 10. Risiken & Rollback

- **Datenverlust:** Hard-Delete ist per Definition irreversibel für Conversation +
  Messages. Guard schützt RFQ/Trade-Daten. Kein Soft-Delete/Undo — bewusst akzeptiert.
- **Restrisiko Race Condition:** siehe NFR 4.2 — durch `EXCEPTION WHEN
  foreign_key_violation` abgefangen, kein Datenverlust, nur ein sauberer
  Business-Error statt eines rohen DB-Fehlers.
- **Verwaiste Zeilen:** `quote_requests`/`message_dispatch` können nach einem Delete
  verwaist zurückbleiben. Bewusst akzeptiert (Abschnitt 5), kein Cleanup in diesem
  Scope.
- **Rollback der Migration:** `DROP FUNCTION public.delete_conversation(uuid);` und
  `DROP INDEX` der drei neuen Indizes stellen den Vorzustand wieder her. Es gibt
  keinen Daten-Rollback für bereits gelöschte Conversations.

---

## 11. Häufige Implementierungsfehler, die explizit zu vermeiden sind

Diese Liste existiert, weil sie typische Fehler eines automatisierten
Implementierungsmodells sind — jeder Punkt hier wurde in diesem Bauplan bereits
durch eine konkrete Vorgabe in Abschnitt 6 adressiert. Vor Abschluss gegen diese
Liste prüfen:

- [ ] `return` in einem `finally`-Block verwendet, der eine Exception verschluckt.
- [ ] Nach einem `await`, der React-State aktualisiert, wird derselbe State
      innerhalb derselben Funktion als bereits aktualisiert angenommen (Stale
      Closure).
- [ ] Fehler-/Erfolgsanzeige über `setError`/den `error`-State statt über `toast()`
      (dadurch bei ausgewähltem Chat unsichtbar).
- [ ] `AlertDialogAction`-`onClick` ohne `event.preventDefault()` → Dialog schließt,
      bevor die Async-Operation abgeschlossen ist.
- [ ] `AlertDialogAction` ohne `buttonVariants({ variant: "destructive" })` →
      Confirm-Button sieht wie eine normale Primäraktion aus.
- [ ] Fehlende Indizes in der Migration → Full-Table-Scans bei jedem Delete.
- [ ] `not_authorized` vs. "conversation not found" unterschiedlich behandelt
      (Information Leak).
- [ ] i18n-Keys nur in `en.json` ergänzt, `de.json`/`fr.json` vergessen.
- [ ] `plan(134)` in der pgTAP-Datei nicht an die neue Assertion-Anzahl angepasst.
- [ ] Bestehende Migrationsdateien bearbeitet statt eine neue anzulegen.
- [ ] `ChatContextMenu.tsx`/`ChatList.tsx` verändert, obwohl deren Contracts bereits
      ausreichen.
- [ ] Guard umgangen/kaskadierend RFQ-Responses oder Trade-Deals mitgelöscht
      (widerspricht der expliziten Entscheidung in diesem Bauplan).
- [ ] Neue Idempotenz-/Retry-Logik für den Delete-Call eingeführt (Scope-Creep,
      widerspricht NFR 4.6).

---

## 12. Freigabe-Gate

Dieser Bauplan spiegelt den bereits bestätigten Scope wider (Backend Hard-Delete,
Guard blockiert bei RFQ-Responses/Trade-Deals). **Vor Beginn der Implementierung ist
weiterhin eine explizite Freigabe des Auftraggebers erforderlich** (Übergang
PLANNING → IMPLEMENTING). Dieses Dokument selbst nimmt noch keine Code-Änderungen
vor.
