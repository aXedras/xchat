---
name: xchat-orientation
description: "Use when orienting on the xChat codebase: locating relevant files, understanding module/architecture relationships, or tracing impact/dependencies. Query the graphify knowledge graph (graphify-out/graph.json) first — graphify query/explain/path — before broad source scans."
---

# xChat Codebase Orientation

Use the graphify knowledge graph in `graphify-out/graph.json` to orient on this
repository. For "where should I look / what is connected / what could be
affected" questions, treat the graph as the first stop, then verify with
targeted source reads (source code remains the source of truth).

## When to use this skill

- You need to find where a feature lives and don't know the file yet.
- You need to understand how two modules relate, or what a symbol is.
- You need to estimate the impact/dependency blast radius of a change.
- You are about to make a cross-module change and need the lay of the land.

Skip this skill (go straight to source) when the exact file/symbol is already
known and the task is local.

## How to query

- `graphify query "<focused question>"` — broad discovery; one concern per query.
- `graphify explain "<symbol>"` — plain-language view of a node and its neighbors.
- `graphify path "<A>" "<B>"` — shortest relationship between two known concepts.

## xChat architecture in brief

Dependency direction is one-way:

```
pages / components  →  hooks  →  repositories  →  Supabase RPCs
```

- `src/types/chat.ts` is the messaging domain hub (the `Chat`, `Message`, and
  RFQ/quote types); many components reference it — this shows up in the graph as
  the high-degree `Chat` node.
- `src/services/persistence/messageRepository.ts` and
  `chatConversationRepository.ts` are the only place Supabase is called. UI never
  talks to Supabase directly.
- `src/lib/utils.ts` (`cn()`) is the highest-degree node — it is imported by
  nearly every UI component (expected utility hub, not a design problem).
- `getSupabaseBrowserClient()` is the single entry point to the Supabase client.
- Supabase schema lives as timestamped migrations under `supabase/migrations/`;
  the messaging/RFQ tables and `SECURITY DEFINER` RPCs form a distinct graph
  region (look for `public.*` nodes).

## Discipline

- Keep one focused architectural concern per `graphify query`; split multi-part
  questions.
- Once a symbol is known, prefer `graphify explain` over another broad query.
- If a query returns a large/truncated result, narrow it rather than raising
  the budget.
- Verify implementation details in source after graphify narrows the search.
- Rebuild after code changes with `graphify update .`.
