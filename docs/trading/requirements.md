# xChat Trading Platform — Requirements Ledger

Status: draft (Phase 1)
Source of truth: docs/xChat_RFQ_Trading_Platform_Implementierungsbauplan.md (Planstand 2026-09-18)

Every in-scope requirement owns a stable ID. IDs are grouped by prefix and are never reused or renumbered.
Traceability from requirement to code and test artefacts lives in docs/trading/traceability.md.

## ID prefixes

| Prefix | Domain                                                                 |
| ------ | ---------------------------------------------------------------------- |
| ORG    | Organizations, memberships, capabilities, platform roles, entitlements |
| RFQ    | RFQ aggregate, dispatch, invitations, state machines                   |
| QUO    | Quotations, counter offers, pricing components                         |
| DEAL   | Deals, booking, trade confirmation semantics                           |
| DOC    | Documents, storage, Typst worker                                       |
| SEC    | Security, recipient isolation, RLS, IDOR                               |
| INV    | Inventory projection and providers                                     |
| CMP    | Compliance snapshots and providers                                     |
| VOL    | Trade volume and CSV import                                            |
| UX     | UI/chat integration, composer, accessibility, i18n                     |
| OUT    | Explicit scope boundaries for Release 1 (non-goals)                    |

---

## ORG — Organizations, memberships, capabilities, roles, entitlements

| ID      | Requirement                                                                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ORG-001 | Every platform user is an employee of exactly one active organization.                                                                                                                                               |
| ORG-002 | Users never trade privately on xChat; they always act as representatives of their organization.                                                                                                                      |
| ORG-003 | An organization may hold multiple business capabilities (e.g. a refiner may buy feedstock, offer refining and sell refined products).                                                                                |
| ORG-004 | Organization type/capability is strictly separated from user rights (roles/entitlements).                                                                                                                            |
| ORG-005 | `profile.organization` free text is replaced by a normalized `organizations` table and active `organization_memberships`.                                                                                            |
| ORG-006 | `organizations` implements the columns, length/status checks, partial unique index on `(source_system, external_reference)`, case-insensitive `display_name` index, and `updated_at` trigger defined in section 8.1. |
| ORG-007 | `organization_capabilities` implements validity ranges (`valid_from`/`valid_until`) and a partial unique index guaranteeing at most one active capability per `(organization_id, capability_code)`.                  |
| ORG-008 | `organization_units` implements a self-FK tree and a constraint trigger rejecting cross-organization parents.                                                                                                        |
| ORG-009 | `organization_memberships` stores historical periods and enforces at most one active membership per user via a partial unique index.                                                                                 |
| ORG-010 | An active membership may only reference an active organization; activation of a user requires an active organization.                                                                                                |
| ORG-011 | `platform_roles`, `platform_entitlements`, `platform_role_entitlements` and organization-scoped `user_platform_roles` are created and seeded with a base matrix.                                                     |
| ORG-012 | Capability codes are limited to `MINE_OPERATOR`, `CPP`, `REFINER`, `TRADER`, `DEALER`, `BANK`, `VAULT`, `FABRICATOR`, `MINT`, `LOGISTICS_PROVIDER`, `INVESTOR`, `AUDITOR`, `OTHER`.                                  |
| ORG-013 | Platform roles include `PLATFORM_ADMIN`, `ORG_ADMIN`, `TRADER`, `SALES`, `OPERATIONS`, `COMPLIANCE`, `VIEWER`; the minimal entitlement set from section 5.4 is modeled.                                              |
| ORG-014 | The participant directory is server-authoritative (`list_trading_participants`); the localStorage/seed company directory is removed from the new path.                                                               |
| ORG-015 | `current_organization_membership()`, `has_entitlement(code)` and `organization_has_capability(org_id, code)` are implemented as `SECURITY DEFINER` functions and check user and organization status.                 |
| ORG-016 | RFQ/Deal tables store organization snapshots so later employment changes do not reinterpret history (see AS-05).                                                                                                     |
| ORG-017 | The directory never exposes private profiles, undisclosed e-mail addresses or compliance files.                                                                                                                      |
| ORG-018 | A minimal admin UI for organizations, capabilities, units and user assignment exists; every admin mutation is guarded by its own entitlement and org-scope check.                                                    |

---

## RFQ — RFQ aggregate, dispatch, invitations, state machines

| ID            | Requirement                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RFQ-001       | Every transaction macro opens the same composer frame with four directly reachable tabs: Commercial, Material, Assay, Logistics.                                                                                                                 |
| RFQ-002       | Common commercial RFQ fields (transaction type, reference, response deadline, settlement currency, price-basis preference, benchmark, payment terms, tax context, partial fulfilment flag, notes) are implemented with the rules in section 6.3. |
| RFQ-003       | Common material RFQ fields (primary metal, material form, product name/code, quantity/unit, tolerance, fineness, lot count, packaging, inventory references) are implemented with the rules in section 6.3.                                      |
| RFQ-004       | Common assay RFQ fields (assay status/method/date, laboratory, composition, settlement preference, sampling, umpire terms, document ids) are implemented with the rules in section 6.3.                                                          |
| RFQ-005       | Common logistics RFQ fields (current/delivery location, availability, delivery window, incoterm, transport/insurance responsibility, security, export/import constraints, document ids) are implemented with the rules in section 6.3.           |
| RFQ-006       | The seven transaction macros `REFINE_AND_RETURN`, `SELL_DORE`, `REFINE_AND_SELL`, `BUY_REFINED_METAL`, `SELL_REFINED_METAL`, `FABRICATE_METAL`, `BUY_FEEDSTOCK` are supported end to end.                                                        |
| RFQ-007       | An RFQ may be sent to multiple recipients.                                                                                                                                                                                                       |
| RFQ-008       | The sender sees per-recipient delivery, view and response status.                                                                                                                                                                                |
| RFQ-009       | `quote_requests` is extended with `requester_organization_id`, `transaction_type`, `schema_version`, `public_reference`, `terms`, `status`, `response_deadline`, `closed_at`, `close_reason` and the indexes of section 8.2.                     |
| RFQ-010       | `quote_request_invitations` is extended with `recipient_organization_id`, extended status, delivery/view/response/close timestamps and `close_reason`, with the constraints of section 8.2.                                                      |
| RFQ-011       | `quote_request_events` is created append-only (no update/delete for `authenticated`).                                                                                                                                                            |
| RFQ-012       | The RFQ state machine (`draft`, `open`, `awarded`, `closed_no_award`, `expired`, `cancelled`) is implemented per section 10.1.                                                                                                                   |
| RFQ-013       | The invitation state machine (`sent`, `delivered`, `viewed`, `responded`, `declined`, `closed`, `expired`) is implemented per section 10.2 with monotonic timestamps.                                                                            |
| RFQ-014       | `create_and_dispatch_quote_request_v2` performs idempotent multi-recipient fan-out in a single transaction, reusing the bilateral conversation resolver.                                                                                         |
| RFQ-015       | `response_deadline` is required for sent RFQs and is validated against server time and a maximum horizon.                                                                                                                                        |
| RFQ-016       | `partialFulfilmentAllowed` is forced to `false` in Release 1.                                                                                                                                                                                    |
| RFQ-017       | RFQ expiry is a computed status; a periodic materialization job is introduced only if a concrete need exists.                                                                                                                                    |
| RFQ-AWARD-001 | Release 1 awards an RFQ to exactly one winner; split awards and partial-quantity awards are out of scope.                                                                                                                                        |

---

## QUO — Quotations, counter offers, pricing components

| ID      | Requirement                                                                                                                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QUO-001 | `quote_responses` is extended with `responder_organization_id`, `schema_version`, `response_terms`, `valid_until` and the extended status set (`submitted`, `countered`, `superseded`, `withdrawn`).                               |
| QUO-002 | `quote_pricing_components` is created with the columns, unique `(response_id, sequence_no)` constraint and value-shape constraints of section 8.3.                                                                                 |
| QUO-003 | Pricing component types cover `METAL_PRICE`, `PREMIUM`, `DISCOUNT`, `REFINING_CHARGE`, `TREATMENT_CHARGE`, `ASSAY_FEE`, `FABRICATION_FEE`, `LOGISTICS_FEE`, `INSURANCE_FEE`, `MINIMUM_CHARGE`, `TAX`, `BYPRODUCT_CREDIT`, `OTHER`. |
| QUO-004 | Each component carries `calculationMethod`, `rateOrAmount`/`formula`, `currency`/`unit`, `chargeDirection`, `taxTreatment`, optional min/max and notes.                                                                            |
| QUO-005 | Premium is expressed as a concrete pricing component, never as a mandatory global requester field.                                                                                                                                 |
| QUO-006 | Fees are captured as individual components with direction, unit and tax treatment.                                                                                                                                                 |
| QUO-007 | The quotation state machine (`submitted`, `superseded`, `accepted`, `rejected`, `withdrawn`, `expired`) is implemented per section 10.3.                                                                                           |
| QUO-008 | Counter offers form an append-only negotiation chain via `parent_response_id`.                                                                                                                                                     |
| QUO-009 | A counter logically supersedes the previous response without mutating it.                                                                                                                                                          |
| QUO-010 | `valid_until` is bounded by the RFQ deadline and validated server-side.                                                                                                                                                            |
| QUO-011 | Submitted responses and their pricing components are immutable.                                                                                                                                                                    |
| QUO-012 | Only the concrete invitation recipient may submit the initial response.                                                                                                                                                            |
| QUO-013 | Withdrawal is limited to the responder's own latest undecided response.                                                                                                                                                            |
| QUO-014 | Legacy responses carrying only `quoted_premium` remain readable as schema version 0.                                                                                                                                               |

---

## Transaction macro specifics (P1-005)

Each of the seven macros has its own requirement group describing request and quotation specifics per section 6.5.

| ID          | Macro              | Requirement                                                                                                                                                                                                                                                                       |
| ----------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RFQ-RAR-001 | REFINE_AND_RETURN  | Request captures feedstock type, dry/wet weight, moisture, expected fine metals, deleterious elements, batch/lot info; provisional assay, sampling/splitting, final assay authority and umpire rules; desired turnaround, metal-account target, return form and minimum recovery. |
| QUO-RAR-001 | REFINE_AND_RETURN  | Quotation offers refining charge, assay fee, minimum charge, metal loss/retention, payability, recovery, byproduct credits and turnaround commitment.                                                                                                                             |
| RFQ-SD-001  | SELL_DORE          | Request captures doré weight, expected Au/Ag/PGM contents, origin/lot references; existing assay and settlement assay method; desired price basis and settlement timing; no requester-invented supplier fees.                                                                     |
| QUO-SD-001  | SELL_DORE          | Quotation offers payability per metal, benchmark/formula, treatment/refining charges, deductions, penalties and settlement timing.                                                                                                                                                |
| RFQ-RAS-001 | REFINE_AND_SELL    | Request combines REFINE_AND_RETURN and SELL_DORE; captures whether sale settles on provisional or final assay, the price-fixing window, and whether refining fees are separate or netted in the purchase price.                                                                   |
| QUO-RAS-001 | REFINE_AND_SELL    | Quotation combines refining-return and purchase terms into one structured offer.                                                                                                                                                                                                  |
| RFQ-BRM-001 | BUY_REFINED_METAL  | Request captures form, brand, refinery, accreditation, fineness, bar size, piece count, serial/bar-list availability; desired price basis, currency, quantity and settlement.                                                                                                     |
| QUO-BRM-001 | BUY_REFINED_METAL  | Quotation offers outright or premium price, available quantity, brand, exact product specification and offer validity.                                                                                                                                                            |
| RFQ-SRM-001 | SELL_REFINED_METAL | Request captures existing product, ownership/custody context, bar list, condition and provenance/integrity references.                                                                                                                                                            |
| QUO-SRM-001 | SELL_REFINED_METAL | Quotation offers bid price or discount, acceptance criteria, inspection requirement and settlement.                                                                                                                                                                               |
| RFQ-FAB-001 | FABRICATE_METAL    | Request captures metal account, available balance, target products, piece counts, sizes, fineness, brand, packaging, desired fabrication date and service scope; uses origin/fineness proof of the account balance without imposing unnecessary assay.                            |
| QUO-FAB-001 | FABRICATE_METAL    | Quotation offers fabrication fee per unit, setup fee, minimum charge, metal loss/tolerance and lead time.                                                                                                                                                                         |
| RFQ-BF-001  | BUY_FEEDSTOCK      | Request captures sought material, quantity band, accepted origin, assay band, delivery window and purchase terms.                                                                                                                                                                 |
| QUO-BF-001  | BUY_FEEDSTOCK      | Quotation offers concrete available material, quantities, assay, location and price formula.                                                                                                                                                                                      |

---

## DEAL — Deals, booking, trade confirmation semantics

| ID           | Requirement                                                                                                                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEAL-001     | `trade_deals` is extended with requester/counterparty organization, `transaction_type`, unique non-guessable `deal_reference`, `status`, `confirmation_status`, `commercial_terms_snapshot`, `booked_at` and `version`.                                                |
| DEAL-002     | `deal_events` is created append-only with the event types of section 8.4.                                                                                                                                                                                              |
| DEAL-003     | The deal + confirmation state machine (section 10.4) is implemented; `confirmation_status` is kept separate from deal status.                                                                                                                                          |
| DEAL-004     | `build_deal_snapshot` produces a complete immutable snapshot: request terms, selected response terms, pricing components, party legal/display names, organization ids, acting user ids, compliance snapshot ids, inventory references, schema versions and timestamps. |
| DEAL-005     | `book_quote_response_v2` is atomic: request/response locks, `DEAL_BOOK` entitlement, RFQ owner check, valid-response check and single-award enforcement.                                                                                                               |
| DEAL-006     | A deal stays `booked` even if document generation fails; the failure is visible and retryable.                                                                                                                                                                         |
| DEAL-007     | `confirmation_status` is maintained independently of the deal status (see DEAL-SEM-001).                                                                                                                                                                               |
| DEAL-008     | The external deal reference is unique and not sequentially guessable.                                                                                                                                                                                                  |
| DEAL-SEM-001 | Accepting a valid quotation via `BOOK_DEAL` conclusively books the trade; the trade confirmation documents the already-booked trade. Later confirmation acknowledgement is an evidence/control step, not a second precondition for the deal.                           |

---

## DOC — Documents, storage, Typst worker

| ID      | Requirement                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-001 | Three document types exist: RFQ Summary, Quotation, Trade Confirmation.                                                                                                      |
| DOC-002 | `documents` stores logical document identity and type.                                                                                                                       |
| DOC-003 | `document_versions` stores immutable file versions with storage path, SHA-256, MIME, size and template version; unique `(document_id, version_no)`.                          |
| DOC-004 | `document_tags` stores normalized key/value tags as defined in section 14.4.                                                                                                 |
| DOC-005 | `document_access_grants` scopes access to organizations/users with rights and validity.                                                                                      |
| DOC-006 | `document_generation_jobs` stores idempotency key, payload hash, retry count and error classification; unique job key from source object + type + template version + locale. |
| DOC-007 | `document_events` is append-only for view/download/send/acknowledge audit.                                                                                                   |
| DOC-008 | Private buckets `trade-documents`, `trade-document-sources`, `trade-volume-imports` are created; public access and client bucket listing are disabled.                       |
| DOC-009 | Rendering is reproducible: same version re-renders identical business content; layout changes produce a new version.                                                         |
| DOC-010 | Typst runs in a separate containerized `document-worker`; no Typst binary in the browser and no service-role key in the frontend.                                            |
| DOC-011 | Signed document URLs are short-lived, created only after a grant check, and never accept arbitrary storage paths from client payloads.                                       |
| DOC-012 | Document visibility follows the matrix of section 14.1 (requester + per-recipient isolation; deal parties only for confirmations).                                           |
| DOC-013 | PDF magic bytes, maximum size and SHA-256 are verified before persisting a rendered file.                                                                                    |
| DOC-014 | Document acknowledgement updates `confirmation_status`, not the creation of the deal.                                                                                        |
| DOC-015 | Signed URLs are never stored in persistent chat messages.                                                                                                                    |
| DOC-016 | The Typst renderer implements the `DocumentRenderer` port as the single renderer in Release 1.                                                                               |

---

## SEC — Security, recipient isolation, RLS, IDOR

| ID      | Requirement                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-001 | RLS is defense in depth; trading tables get no direct client write grants; writes and sensitive reads go through narrowly scoped `SECURITY DEFINER` RPCs. |
| SEC-002 | Every new RPC sets `search_path = ''`, uses fully qualified names, ends with `GRANT EXECUTE TO authenticated` and `REVOKE ... FROM PUBLIC, anon`.         |
| SEC-003 | A recipient must never learn the identity, count or status of other RFQ recipients.                                                                       |
| SEC-004 | No recipient endpoint returns `request_id -> invitations[]`.                                                                                              |
| SEC-005 | A recipient reads an invitation only via their own `invitation_id` and `recipient_user_id = auth.uid()`.                                                  |
| SEC-006 | Response queries start from the authorized invitation, never from the request.                                                                            |
| SEC-007 | Realtime topics remain `user:{auth.uid}`; no RFQ-wide recipient topics.                                                                                   |
| SEC-008 | Errors must not reveal the existence of other invitations.                                                                                                |
| SEC-009 | Counts, winner, response count and recipient status appear only in the requester projection DTO.                                                          |
| SEC-010 | A losing recipient receives only a neutral `RFQ_CLOSED`; no winner identity, price or organization info.                                                  |
| SEC-011 | Signed document URLs are created only after grant checks and are short-lived.                                                                             |
| SEC-012 | Storage bucket listing is forbidden for clients.                                                                                                          |
| SEC-013 | Negative pgTAP and E2E tests use at least three organizations and systematically attempt IDOR access.                                                     |
| SEC-014 | `auth.uid()` is checked first in every RPC.                                                                                                               |
| SEC-015 | All IDs from request payloads are validated server-side against visibility and ownership.                                                                 |
| SEC-016 | No hard delete of RFQs, responses, deals, documents or audit events.                                                                                      |
| SEC-017 | No service-role key or secret is exposed to the browser bundle.                                                                                           |
| SEC-018 | Requester and recipient projections use separate TypeScript types and separate SQL builders; a shared DTO with hidden optional fields is not allowed.     |
| SEC-019 | Security test identities cover at least 5 users in 4 organizations (same-org non-recipient and cross-recipient attack separation).                        |

---

## INV — Inventory projection and providers

| ID      | Requirement                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| INV-001 | An `InventoryProvider` port is defined (sync + get lot + health).                                                                     |
| INV-002 | A deterministic `MockInventoryProvider` implements the port; production BIL is out of scope for Release 1.                            |
| INV-003 | `inventory_lots` and `inventory_sync_runs` tables are migrated per section 8.5.                                                       |
| INV-004 | Sync upserts by `(source_system, organization_id, external_reference)`.                                                               |
| INV-005 | Lots removed externally are marked `unavailable`, never hard-deleted.                                                                 |
| INV-006 | Source timestamp, sync timestamp and raw source hash are stored.                                                                      |
| INV-007 | BIL data never implies an ownership claim.                                                                                            |
| INV-008 | Inventory reads are scoped to the active user organization.                                                                           |
| INV-009 | An RFQ stores a snapshot of the referenced inventory's core fields.                                                                   |
| INV-010 | A provider error is explicit and never surfaces as a successful empty result.                                                         |
| INV-011 | Contract tests guarantee the mock and any future BIL adapter fulfil the identical inventory DTO contract (production-identical port). |

---

## CMP — Compliance snapshots and providers

| ID      | Requirement                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMP-001 | A `ComplianceProvider` port is defined (counterparty snapshot + health).                                                                           |
| CMP-002 | A deterministic `MockComplianceProvider` implements the port with `approved`, `review_required`, `blocked`, `expired`, `unavailable` fixtures.     |
| CMP-003 | `compliance_snapshots` is migrated per section 8.5.                                                                                                |
| CMP-004 | Only minimal required status data is copied; full KYC files are never replicated.                                                                  |
| CMP-005 | Compliance reads are scoped to the viewer organization.                                                                                            |
| CMP-006 | A policy matrix defines which compliance statuses block send, respond and book.                                                                    |
| CMP-007 | `blocked` compliance is fail-closed for send/book in Release 1.                                                                                    |
| CMP-008 | Compliance results never default to `approved`.                                                                                                    |
| CMP-009 | Snapshot expiry and stale status are computed server-side.                                                                                         |
| CMP-010 | The RFQ/Deal snapshot stores the compliance snapshot id used for the decision.                                                                     |
| CMP-011 | Contract tests guarantee the mock and any future xComplianceFlow adapter fulfil the identical compliance DTO contract (production-identical port). |

---

## VOL — Trade volume and CSV import

| ID      | Requirement                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| VOL-001 | `trade_volume_entries` is append-only with the columns of section 8.6.                                        |
| VOL-002 | Source types are `xchat_deal`, `csv_import`, `adjustment`.                                                    |
| VOL-003 | A unique entry per organization/deal prevents duplicate deal entries.                                         |
| VOL-004 | Quantities normalize deterministically to grams for AU/AG/PT/PD.                                              |
| VOL-005 | `trade_volume_import_batches` and `trade_volume_import_rows` implement the batch/row statuses of section 8.6. |
| VOL-006 | CSV import is staged: upload, validate, preview, commit.                                                      |
| VOL-007 | CSV entries are idempotent via batch + row hash.                                                              |
| VOL-008 | Corrections are postings (adjustments), never updates of history.                                             |
| VOL-009 | Commit is blocked while any invalid row exists (no partial-import mode in Release 1).                         |
| VOL-010 | Aggregation is available per counterparty, metal, period and source, scoped to the authorized organization.   |
| VOL-011 | Deal prices are not included in trade-volume aggregates unless explicitly required.                           |
| VOL-012 | A reconciliation job finds booked deals without a volume entry.                                               |

---

## UX — UI/chat integration, composer, accessibility, i18n

| ID     | Requirement                                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-001 | `/rfq` opens a launcher of permitted transaction types; direct slash commands exist for all seven macros.                                                                                                                                                |
| UX-002 | Unavailable macros are explained when typed, not just hidden.                                                                                                                                                                                            |
| UX-003 | The recipient picker searches by person, organization, capability or desk.                                                                                                                                                                               |
| UX-004 | Recipients are grouped visually by organization but only concrete user IDs are transmitted.                                                                                                                                                              |
| UX-005 | The composer shows a persistent header (transaction type, recipients, status, deadline) and footer (Save Draft, Preview, Send).                                                                                                                          |
| UX-006 | Each tab shows an error count and completeness state via a badge.                                                                                                                                                                                        |
| UX-007 | The deadline picker offers presets (15 min, 1 h, end of business day, 24 h, custom); seconds are never a primary input.                                                                                                                                  |
| UX-008 | Preview renders exactly the recipient view without the recipient list.                                                                                                                                                                                   |
| UX-009 | On server validation errors the UI jumps to the first affected tab.                                                                                                                                                                                      |
| UX-010 | Structured chat-card message types (`rfq_created`, `rfq_closed`, `quotation_submitted`, `quotation_countered`, `quotation_rejected`, `deal_booked`, `document_generated`, `trade_confirmation_sent`, `trade_confirmation_acknowledged`) are implemented. |
| UX-011 | The requester dashboard shows recipient status chips, comparable responses, normalized pricing components, compliance warnings and a final Book Deal confirmation.                                                                                       |
| UX-012 | The error handling matrix of section 13.6 is implemented (validation, expiry, version conflict, partial dispatch, compliance block, provider unavailable, document failure, unknown result).                                                             |
| UX-013 | `clientOperationId` is generated on first attempt and reused on unknown results.                                                                                                                                                                         |
| UX-014 | After a server-confirmed submit the UI offers no local undo; explicit cancel/withdraw actions are used instead.                                                                                                                                          |
| UX-015 | Every user-facing string is present in EN, DE and FR with identical structure.                                                                                                                                                                           |

---

## Scope boundaries (Release 1 non-goals)

| ID         | Boundary                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------ |
| OUT-001    | No split awards or partial-quantity awards (see RFQ-AWARD-001).                                  |
| OUT-002    | No automatic price calculation from live market data (see OUT-MD-001).                           |
| OUT-003    | No productive BIL or xComplianceFlow connection; only ports, adapters, mocks and contract tests. |
| OUT-004    | No settlement, payment, shipment tracking or ERP posting after trade confirmation.               |
| OUT-005    | No electronic signature or QES workflow.                                                         |
| OUT-006    | No automatic legal assessment of the bindingness of a trade.                                     |
| OUT-007    | No anonymous auction; the RFQ sender knows all invited recipients.                               |
| OUT-008    | No direct browser access to external BIL, compliance or document-worker APIs.                    |
| OUT-MD-001 | Live market data and price-ticker integration are not part of this stage.                        |

---

## Decision mapping (bauplan section 2)

### Confirmed decisions (section 2.1)

| Decision                                                              | Requirement ID(s)     |
| --------------------------------------------------------------------- | --------------------- |
| 1. One active organization per user                                   | ORG-001, ORG-009      |
| 2. Users act as organization representatives                          | ORG-002               |
| 3. Multiple capabilities per organization                             | ORG-003               |
| 4. Capability separated from user rights                              | ORG-004               |
| 5. Bilateral / fan-out, cross-organization                            | RFQ-007               |
| 6. Multiple recipients per RFQ                                        | RFQ-007               |
| 7. Sender sees per-recipient status                                   | RFQ-008               |
| 8. Recipient isolation                                                | SEC-003               |
| 9. KYC/KYS via ports + mocks                                          | CMP-001, CMP-002      |
| 10. Inventory as server projection + mock                             | INV-001, INV-002      |
| 11. Trade volume from deals + CSV import                              | VOL-001, VOL-006      |
| 12. No live market data                                               | OUT-MD-001            |
| 13. New customer document storage on Supabase Storage                 | DOC-001, DOC-008      |
| 14. RFQ Summary / Quotation / Confirmation via Typst as chat messages | DOC-001, DOC-010      |
| 15. BOOK_DEAL and Trade Confirmation in scope                         | DEAL-005, DOC-001     |
| 16. xTrace not part of target picture                                 | (baseline; no new ID) |
| 17. Stale README not source of truth                                  | (baseline; no new ID) |
| 18. npm + package-lock authoritative; bun.lockb legacy                | (baseline; no new ID) |

### Booking semantics (section 2.2)

| Assumption                                                                  | Requirement ID |
| --------------------------------------------------------------------------- | -------------- |
| BOOK_DEAL conclusively books the trade; confirmation is downstream evidence | DEAL-SEM-001   |

### Scope boundaries (section 2.3)

| Boundary                              | Requirement ID         |
| ------------------------------------- | ---------------------- |
| Single award only                     | RFQ-AWARD-001, OUT-001 |
| No live price calc                    | OUT-002, OUT-MD-001    |
| Ports/mocks only                      | OUT-003                |
| No settlement/payment/shipment/ERP    | OUT-004                |
| No e-signature/QES                    | OUT-005                |
| No auto legal bindingness assessment  | OUT-006                |
| No anonymous auction                  | OUT-007                |
| No direct external API browser access | OUT-008                |

## Cross-cutting requirement

| ID     | Requirement                                         |
| ------ | --------------------------------------------------- |
| UX-015 | EN/DE/FR completeness for every user-facing string. |

## Decision Log

Semantic decisions and any open questions are recorded here explicitly (Gate P1).

| #   | Topic               | Decision / status                                                                                                   | Reference                 |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Booking semantics   | BOOK_DEAL conclusively books the trade; confirmation is downstream evidence. Documented as the standard assumption. | DEAL-SEM-001, ADR-004     |
| 2   | Single award        | Release 1 awards exactly one winner; no split/partial awards.                                                       | RFQ-AWARD-001             |
| 3   | Market data         | No live market-data / price-ticker integration in this stage.                                                       | OUT-MD-001                |
| 4   | Providers           | Mock providers with production-identical ports; no productive BIL/xComplianceFlow.                                  | CMP-011, INV-011, OUT-003 |
| 5   | Recipient isolation | No-tolerance cross-recipient isolation, structurally enforced.                                                      | SEC-003, ADR-003          |

No open semantics questions remain at this time. If one arises during implementation, it is
added here and blocked until decided (per bauplan section 20).

## Feature flags (P1-013)

| Flag                     | Scope                                                         |
| ------------------------ | ------------------------------------------------------------- |
| `tradingOrganizationsV2` | Organizations, memberships, capabilities, roles, entitlements |
| `transactionRfqV2`       | Transaction-specific RFQ forms and dispatch                   |
| `quotationV2`            | Quotation, counter offers, pricing components                 |
| `dealV2`                 | Booking and deal snapshot                                     |
| `documentsV1`            | Document storage and Typst pipeline                           |
| `tradeVolumeV1`          | Trade volume ledger and CSV import                            |
