# xChat Backlog

## Product Goal

xChat evolves from a professional chat product into a trading and operations platform for precious metals participants. The target state is a verified, high-signal communication environment where counterparties can discover liquidity, run RFQs, negotiate offers, confirm trades, coordinate logistics, and execute post-trade workflows with auditable data and documents.

## Current Baseline

- Chat foundation exists with realtime and persistence options.
- RFQ and offer workflows already exist at application level.
- Admin capabilities exist for API connectivity, company registration, and customer fee maintenance.
- Fee handling exists today as application logic and admin tooling, but not yet as a fully integrated trading rule engine backed by external source systems.
- Inventory, ledger, market data, document generation, and post-trade integrations are not yet implemented as production-grade capabilities.

## Priority Now

### 1. Bullion Integrity Ledger Connectivity

- Establish connectivity to the Bullion Integrity Ledger so xChat can consume authoritative participant, asset, and provenance data.
- Define the integration contract for identities, bar or lot references, ownership state, integrity attributes, and event timestamps.
- Expose BIL-backed status and traceability inside chats, RFQs, and trade confirmations.
- Add audit logging for every BIL lookup, sync, and downstream trade decision.

### 2. Inventory-Aware Trading Platform

- Turn xChat into a trading platform with RFQ, quote, counter-offer, acceptance, rejection, and conversion-to-trade workflows.
- Connect RFQ flows to BIL inventory or inventory-adjacent source systems so users can see what is actually available to trade.
- Introduce inventory reservation or soft-allocation during active RFQs to reduce double-selling risk.
- Show available quantity, asset identifiers, location, delivery readiness, and ownership constraints in the trading workflow.
- Support different precious metals product classes, units, and packaging forms.
- **Context-Aware Side Panels**: Tab-based right panel in ChatWindow with Customer View (CRM/Kundenbuch with chronological transaction + chat-summary timeline) and Inventory View (trader cockpit with positions, inflows, outflows). See [bauplan-side-panels.md](bauplan-side-panels.md) for detailed specification.

### 3. Professional Participant Zone

- Build a verified participant environment focused on signal, accountability, and professional conduct.
- Add strong identity, firm affiliation, role-based permissions, and counterparty verification.
- Add moderation, abuse handling, and policy enforcement suitable for regulated trading relationships.
- Add message retention, legal hold, and audit requirements for professional communications.

### 4. Fee Rule Engine

- Evolve the current fee logic into a configurable business-rule engine for trade and relationship pricing.
- Support fees by customer, counterparty relationship, product class, deal size, tenor, location, and channel.
- Support stacking rules for spread, surcharge, fixed fee, minimum fee, and exception handling.
- Provide simulation tooling so sales or trading teams can preview fee impact before sending a quote.
- Persist fee policies in a durable backend with approval history and effective dates.

## Priority Next

### 5. Market Data Connectivity

- Add market data connectivity for spot, forwards, fixing references, FX rates, and internal pricing curves.
- Support configurable market data sources and failover strategy.
- Timestamp every quote with the source market context used to calculate it.
- Make live pricing visible in chat, RFQ preparation, and quote-response screens.

### 6. Trade Documents via Typst

- Generate downloadable documents for every RFQ and response flow using Typst.
- Start with trade confirmation, quotation sheet, shipment instruction, insurance document, commercial invoice, and bar list outputs.
- Ensure every generated document is reproducible from stored trade events and commercial terms.
- Version templates by legal entity, jurisdiction, and product type.

### 7. Post-Trade Operations

- Add shipment, logistics, custody, and settlement workflows after quote acceptance.
- Track allocation, dispatch readiness, airway bill or shipment references, insurance state, and delivery milestones.
- Support exception handling for failed settlement, partial allocation, and delivery delays.
- Provide a unified post-trade timeline attached to each deal.

### 8. Trade Lifecycle Ledger

- Maintain an immutable internal trade event trail for RFQ, quote, counter, acceptance, amendment, cancellation, and settlement steps.
- Link internal trade events to external references such as BIL events, inventory events, and generated documents.
- Support reconstruction of who knew what, when, and based on which data source.

## Platform Capabilities

### 9. Counterparty and Relationship Management

- Model firms, desks, users, bilateral relationships, limits, and approved counterparties.
- Maintain relationship-level configuration for fees, settlement preferences, delivery terms, and documentation requirements.
- Support onboarding and lifecycle changes for counterparties without breaking historical trades.

### 10. Compliance and Controls

- Add sanctions, AML, KYC, and internal policy checks to onboarding and trading flows.
- Add four-eyes approval paths for sensitive quotes, fee overrides, and trade conversions.
- Enforce segregation of duties between trading, sales, operations, and administration.

### 11. Search, Archive, and Evidence

- Provide fast search across chats, RFQs, quotes, deals, documents, and attachments.
- Support exportable evidence packs for audits, disputes, and customer service.
- Preserve business context by linking messages to the commercial objects they created or changed.

### 12. Notifications and Workflow SLA

- Add alerts for RFQ expiry, response deadlines, inventory conflicts, compliance holds, and settlement exceptions.
- Add internal workflow inboxes for traders, operations, and administrators.
- Support escalation paths when counterparties or internal teams miss deadlines.

### 13. Attachment and Data Room Support

- Support secure attachments for specs, assays, certificates, bar lists, and logistics documents.
- Add access control, download audit, malware scanning, and retention rules.
- Allow deal-scoped document bundles for counterparties and operations teams.

### 14. API and Webhook Surface

- Expose a stable API and webhook layer for CRM, ERP, custody, settlement, and market data integrations.
- Publish domain events for RFQ creation, quote submission, trade confirmation, shipment update, and document generation.
- Keep integration boundaries explicit so frontend workflows do not depend on hidden local-only state.

## Product and UX Enhancements

### 15. Structured Chat for Trading

- Add message types for inquiry, RFQ, offer, counter, confirmation, exception, and ops update.
- Let users turn messages into commercial objects directly from the chat stream.
- Add templates and macros for common precious metals workflows without losing free-form conversation.

### 16. Presence, Entitlements, and Directory

- Show desk coverage, online availability, product coverage, and regional support windows.
- Let firms restrict which users can see or negotiate which products and counterparties.
- Add a professional participant directory with discoverability controls.

### 17. Analytics and Commercial Insight

- Add dashboards for RFQ win rate, response time, margin capture, inventory utilization, and counterparty activity.
- Add relationship intelligence such as quote hit ratio, average spread, and operational exception frequency.
- Surface desk-level KPIs without compromising trade confidentiality.

### 18. Mobile and Executive Access

- Provide mobile-safe views for approvals, urgent RFQ actions, and trade monitoring.
- Add executive summary views for pipeline, live inventory exposure, and outstanding exceptions.

## Technical Foundations

### 19. Replace Local-Only Domain Storage

- Replace local browser storage for trading-critical state with durable backend persistence.
- Ensure inventory, fee profiles, trade events, and documents are server-authoritative.
- Keep local fallback limited to clearly non-critical demo behavior.

### 20. Domain Model Hardening

- Formalize domain models for participants, inventory, RFQs, quotes, trades, documents, fees, and settlements.
- Add explicit identifiers, status transitions, and invariants for each commercial object.
- Align UI, persistence, APIs, and integration events around the same domain language.

### 21. Operational Readiness

- Add observability, error logging, integration health checks, retry handling, and reconciliation jobs.
- Add test coverage for end-to-end trade lifecycle, fee evaluation, inventory sync, and document generation.
- Add environment-specific configuration for external integrations and secrets handling.

## Suggested Sequencing

1. Bullion Integrity Ledger connectivity and inventory-aware trading model.
2. Server-authoritative fee engine and relationship management.
3. Market data integration and quote pricing context.
4. Typst document generation and post-trade workflow.
5. Compliance controls, auditability, and external API surface.
