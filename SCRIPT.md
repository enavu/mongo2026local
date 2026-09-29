---
title: Memory That Keeps Up — 10-minute presenter script
---

Speak the **bold** lines. *Italics are stage directions.* Timecodes are targets, not
hard cuts — the demo beats at 2:00, 4:30, and 7:00 are where you stretch or compress.

## [0:00–1:00] Open — deck slide 1

*Deck up, slide 1. Don't touch the app yet.*

> "Everyone's building agents with memory. Vector search, retrieval, the works. But
> here's the failure nobody demos: agents don't fail because they *can't* retrieve.
> They fail because they retrieve the **stale** answer — the thing that was true last
> year, cited with total confidence.
>
> I'm going to show you memory that keeps up. When the rule changes, the answer changes
> with it. All on MongoDB — one database, documents, vectors, and relationships together."

*Advance to slide 2.*

## [1:00–3:00] The problem, live — slide 2, then switch to app

> "Three steps: Recall, Trace, Resolve."

*Switch to the app. Shell scenario is already selected.*

> "Someone asks: which shell do I use to connect to MongoDB? **Recall** — similarity
> search returns the top hit: the `mongo` shell. High score, looks great. It's also
> deprecated."

*Click Next: Trace.*

> "**Trace** — we follow the `supersedes` edge in the same collection. `mongo` was
> replaced by `mongosh`."

*Click Next: Resolve.*

> "**Resolve** — the answer flips to `mongosh`, and it cites the source and the
> deprecation notice. Similarity alone would've handed you the dead answer. The
> **edge**, not the vector, is what makes memory current."

## [3:00–4:30] Make it theirs — app, Ask box

> "Not a scripted rail. Ask it your own words."

*Type in the Ask box: "what replaced the old mongo shell". Hit Ask.*

> "The question is embedded **locally** — no LLM call, no cloud round-trip for the
> query. A paraphrase it's never seen."

*Click Next: Trace, then Next: Resolve.*

> "Same correction. Resolves to `mongosh`, source cited. That's the pattern working on
> live input."

## [4:30–7:00] This is real MongoDB data — Changelog corpus + Atlas

*Click Changelog corpus in the footer.*

> "Everything so far ran on curated memory records. But this" — *it searches
> automatically* — "is the **real MongoDB changelog**. The 9.0, 8.0, and 7.0 release
> notes, chunked and embedded as vectors, sitting in Atlas."

*Point at the results line.*

> "One `$vectorSearch` over 300-plus real release-note sections. Matched by **meaning**,
> not keywords. And look — tens of milliseconds, round-trip to the cloud. Real 9.0
> sections come back: platform support, backward-incompatible features."

*Switch to the Atlas console tab.*

> "And this is the same thing in Atlas. Same `changelog` collection. Same `chlog_vec`
> index. The app and the database are showing you the exact same `$vectorSearch` —
> there's no mock, no fixture behind the curtain."

## [7:00–8:30] The differentiator — Drift check

*Back to the app. Click Drift check. Server shows 9.0.0. Click Check drift.*

> "Here's what retrieval alone can't do. I ask: can my stack run Vector Search on
> server 9.0? The verdict is **provisional** — because 9.0 isn't generally available
> yet. We refuse to invent a compatibility number we can't cite. That honesty *is* the
> feature."

*Change server to 7.0.5. Click Check drift again.*

> "On a GA version, it gives a real verdict — meets the documented minimum, and links
> the source. Memory that knows not just what's true, but what your **stack can
> actually run**."

## [8:30–9:30] Why one database

*Optional: View query dialog.*

> "Why does this live in MongoDB? Because it's one collection holding three things: the
> documents, the vectors, and the relationships between them. No syncing a vector store
> to a system of record and praying they agree. One aggregation — `$vectorSearch`, then
> follow the edges. Three signals, one query."

## [9:30–10:00] Close

> "So — memory that keeps up. It knows what **was** true, and what **is**. When the rule
> changes, the answer changes with it. The whole thing's in the repo with run steps.
> What questions do you have?"

## Timing cushion

If you're running long, cut the free-text Ask (3:00–4:30) — it's the most redundant
beat. If you're running short, linger on the Atlas console and open a changelog document
to show the `embedding` field and the source URL.
