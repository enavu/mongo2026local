---
title: Memory That Keeps Up — 10-minute presenter script
---

Speak the **bold** lines. *Italics are stage directions.* Timecodes are targets, not
hard cuts — the galaxy (1:00) and upgrade impact (5:00) are where you stretch or compress.

## [0:00–1:00] Open — deck slide 1

*Deck up, slide 1. Don't touch the app yet.*

> "Everyone's building agents with memory. Vector search, retrieval, the works. But
> here's the failure nobody demos: agents don't fail because they *can't* retrieve.
> They fail because they retrieve the **stale** answer — the thing that was true last
> year, cited with total confidence.
>
> I'm going to show you memory that keeps up. When the rule changes, the answer changes
> with it — and I'll show it on **MongoDB 9.0** release notes that shipped this month. All
> on MongoDB: one database, documents, vectors, and relationships together."

*Open the galaxy — from the app footer click **Vector galaxy ↗**, or go to `/galaxy`.*

## [1:00–3:00] The star — Vector Galaxy on 9.0

*The whole changelog corpus is on screen as a starfield. Click the `what is new in
MongoDB 9.0` chip (or type it).*

> "Every star here is a real MongoDB changelog section — the full 9.0, 8.0, and 7.0
> release notes plus the mongosh changelog — embedded as a vector, living in Atlas.
> Green is 9.0, blue 8.0, purple 7.0. I ask what's new in 9.0,
> and my question drops into the same space and fires beams to its nearest neighbors."

*Point at a beam label, then the bottom stat.*

> "The number on each beam is the **real** similarity score, straight from
> `$vectorSearch` — matched by meaning, not keywords. And it's **real 9.0 content**:
> platform support, time series, backward-incompatible changes. Tens of milliseconds,
> round-trip to the cloud. The answer panel is the actual release-note text — nothing I
> wrote."

*Click one more chip — `server status metrics renamed` or `what was deprecated in 7.0`.*

> "Every question, a different constellation. Thick green beams are strong matches; thin
> gray ones are weak — you see the confidence before you read a word."

## [3:00–4:00] The embedding idea — release separation

*Tick the `Show release separation` checkbox.*

> "People always ask: how different are these releases, really? Each glowing dot is a
> release's center of mass in embedding space — 9.0, 8.0, 7.0. And look — they're almost
> on top of each other. The readout says it: about four to seven hundredths apart.
> Release notes all sound alike, so the vectors barely separate them."

*Point at the caption.*

> "That's the honest lesson. Embedding distance is a beautiful intuition, but it is **not
> upgrade risk**. If you want to know what actually breaks, you need the real list — and
> that's next."

## [4:00–5:00] Why it doesn't just retrieve — the correction mechanic

*Back in the app tab (`/`). Shell scenario selected. Keep this fast — it's the mechanic,
not the headline.*

> "Retrieval finds what looks relevant. But relevant isn't the same as current. Simplest
> example: which shell connects to MongoDB? Similarity returns the deprecated `mongo`
> shell — high score, wrong answer."

*Click Next: Trace, then Next: Resolve.*

> "We follow the `supersedes` edge, and it flips to `mongosh`, source cited. The
> **edge**, not the vector, makes memory current. That's a five-year-old change everyone
> knows — the point is the *discipline*, and it has to hold on 9.0 too."

## [5:00–7:30] The real risk — Upgrade impact

*Click Upgrade impact. From 7.0 → To 8.0.*

> "This is the question engineers actually lose sleep over: what happens when I upgrade?
> 7.0 to 8.0 — two columns, both from MongoDB's own docs in Atlas. On the left, **what
> breaks**: seventeen changes. 'Queries for null don't match undefined fields.' 'Write
> concern majority.' On the right, **what you gain**: performance improvements, a new
> bulk write command, block-processed time series. The whole decision — risk and payoff
> — side by side."

*Change To → 9.0.*

> "Now to 9.0 — and it says **provisional**, because 9.0 isn't GA. We won't hand you a
> breaking-change list, or a feature list, we can't stand behind yet. That honesty is
> only demonstrable this week, before 9.0 ships."

*Optional — the point check. Click Drift check, feature Vector Search, server 9.0.0,
then 7.0.5.*

> "And the single-feature check: can server 7.0.5 run Vector Search? Supported, with the
> cited minimum. 9.0? Provisional. Same rule everywhere — never a number we can't
> source."

## [7:30–9:00] Why one database

*Optional: View query dialog.*

> "Why does this live in MongoDB? Because it's one collection holding three things: the
> documents, the vectors, and the relationships between them. No syncing a vector store
> to a system of record and praying they agree. One aggregation — `$vectorSearch`, then
> follow the edges. Three signals, one query."

## [9:00–10:00] Close

> "So — memory that keeps up. It knows what **was** true, and what **is**. When the rule
> changes, the answer changes with it. The whole thing's in the repo with run steps.
> What questions do you have?"

## Timing cushion

If you're running long, cut the correction-mechanic beat (4:00–5:00) to a single
sentence, and skip the optional drift point-check — the galaxy, separation, and upgrade
impact carry the story. If you're running short, work more question chips in the galaxy,
or add a third version to the Upgrade impact panel.

## Surfaces

- `/galaxy` — the Vector Galaxy: ask by meaning, plus **Show release separation**.
  Reachable from the app footer via **Vector galaxy ↗**.
- `/deck` — the slide deck.
- `/` — the app: Recall → Trace → Resolve, Ask, **Upgrade impact**, Drift check, Changelog corpus.
- `/changelog` — the standalone changelog search page.
