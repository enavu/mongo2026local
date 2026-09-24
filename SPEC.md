# Memory That Corrects Itself: Agent Memory on Atlas

**Event:** MongoDB .local NYC, 30 September 2026, Champions booth
**Format:** 5 minutes, repeated throughout the day
**Constraints:** Laptop only. No live model. Assume no wifi.

---

## The argument

Vector search has no concept of time.

When a fact is revised, the old version stays in the index and remains semantically near-identical to the correction. That adjacency is exactly why similarity cannot separate them — both statements are about the same thing, so they sit on top of each other in embedding space.

Agent memory built on vector recall alone will therefore retrieve superseded facts with high confidence, indefinitely.

The fix is not a better embedding model. It is keeping the relationships and the timestamps in the same store as the vectors, so one query can see all three.

---

## What the audience sees

Three panes, one query.

| Pane | Query | Result |
|---|---|---|
| 1. Recall | `$vectorSearch` | Top hits, including a stale fact, scored high |
| 2. Expand | `$graphLookup` over those hits | The correction surfaces — the query never matched it |
| 3. Resolve | Re-rank with supersession applied | Stale demoted and annotated; the answer changes |

**The moment.** Pane 1 gives a confident wrong answer. Pane 3 gives the right one.

> A vector store would have handed you the first one, with a great score, and you would have believed it.

**The close — point in time.** Because superseded memories are retained with their edges and timestamps, the system can answer *what did this believe on 3 March*. A plain vector store cannot answer that question at all. It only has now.

For regulated industries that is not a nice-to-have. It is the audit.

---

## Data model

Single collection, `memories`.

```js
{
  _id: ObjectId,
  text: String,
  embedding: [Number],           // omit if using autoEmbed
  kind: "fact" | "correction",
  created_at: ISODate,
  source: String,                // citation, shown on screen
  refs: [
    { to: ObjectId, kind: "supersedes" | "relates_to" }
  ]
}
```

Three decisions are baked in:

**Edges are embedded, not a separate collection.** The single-collection shape is the argument being made. Do not trade it for flexibility that will not be used in five minutes.

**Superseded memories are retained.** Never filtered at write time. The demo depends on vector search finding them.

**Edges live on the newer document**, pointing back at what it replaces.

---

## Pipeline

```js
// 1. recall
{ $vectorSearch: {
    index: "mem_vec",
    path: "embedding",
    queryVector: <q>,
    numCandidates: 100,
    limit: 5
}},

// 2. expand — reverse walk: find documents pointing AT each hit
{ $graphLookup: {
    from: "memories",
    startWith: "$_id",
    connectFromField: "_id",
    connectToField: "refs.to",
    as: "corrections",
    maxDepth: 2
}},

// 3. resolve
{ $addFields: {
    superseded: { $gt: [ { $size: "$corrections" }, 0 ] }
}},
{ $sort: { superseded: 1, score: -1 } }
```

**The trap.** `connectToField: "refs.to"` is the reverse traversal. Inverting the direction returns empty `corrections` arrays and looks like broken edges when the data is fine. Verify this before building anything on top of it.

`$rankFusion` is optional. It combines input pipelines, so it goes *before* `$graphLookup` if used. Vector alone makes the point; add lexical only if time allows.

---

## Corpus

**MongoDB's own release and deprecation history.**

A changelog is a pre-built memory graph. Every release note that revises prior guidance is a correction, carrying a real timestamp and a real supersession relationship. The structure is read off, not synthesized.

Why it is the right substrate:

- **Semantic adjacency comes free.** "How you do X" and "how you do X now" sit on top of each other in embedding space. That is the precise condition that makes vector search fail.
- **The audience can referee.** They know quantization guidance changed. They know operators were superseded. Nobody has to take the demo's word for it.
- **Timestamps are real**, so recency weighting is not a prop.
- **Zero setup narration.** The domain never needs explaining.

### Optional high-value moment

The vector index documentation currently contradicts itself on whether arrays of embeddings can be indexed — the Considerations section says no, while `nestedRoot` exists for exactly that purpose. If the memory graph surfaces both statements and flags the conflict, that is a live contradiction discovered on stage.

Framing is load-bearing here:

> This is what a memory system is for. It noticed the source disagrees with itself.

Not *your docs are wrong.* Same facts, completely different outcome. Rehearse that sentence in isolation.

### Fallback corpus

Any mature open-source project's ADRs, RFCs, or deprecation notices. Same structure, same free timestamps, less charge.

---

## Build order

1. **Verify two assumptions.** That `$graphLookup` accepts a `$vectorSearch` result as its input stage. And whether `autoEmbed` is available on the target tier — if it is, the entire embedding step disappears.
2. **Corpus and edges.** Extract memories, assign timestamps, wire supersession edges. This is the substrate. A thin graph means no demo.
3. **Indexes.** Vector index on `embedding`. Standard index on `refs.to` for the traversal.
4. **Three queries working in a script.** No interface yet.
5. **Display.** Two or three panes, legible from three feet. Scores as bars. Superseded items struck through with the correction beneath. Not a force-directed graph — it will not read at booth distance and it will consume the remaining time.
6. **Narrative, rehearsal, and a two-minute screen recording as fallback.**

---

## Cut list, in order

1. `$rankFusion` and the lexical pipeline
2. Point-in-time close — becomes a spoken claim rather than a live query
3. Third pane — merge resolve into expand, annotate in place
4. Custom interface — a styled HTML table is sufficient

**Floor.** Two panes, three rehearsed questions, one visible correction. That still makes the argument.

---

## Failure modes

| Risk | Mitigation |
|---|---|
| `$graphLookup` will not chain off `$vectorSearch` | Materialize recall results, traverse in a second query. Same visual outcome. |
| `autoEmbed` unavailable | Precompute embeddings. Costs hours, not the demo. |
| Memory graph too thin for a real contradiction | Hand-curate five to eight high-quality memory chains rather than bulk ingesting. Depth beats volume. |
| No wifi | Local `atlas deployments` instance, everything precomputed. Assume this happens. |
| "Neo4j does this too" | One store, one query, no sync job, no window where the graph and the vectors disagree about what is remembered. For memory specifically, that window is the bug. |

---

## Business cases

The shape they share: a fact was true, then it was not, and the system cannot tell the difference.

**Contracts and commercial terms.** Amendments are supersession edges. An agent asked about payment terms retrieves the original contract, not the third amendment. Exposure: honoring renegotiated terms, missed renewal windows, expired rates.

**Regulatory and policy guidance.** Thresholds and requirements are revised on a cadence and are semantically near-identical to their prior versions. Quoting the superseded rule is a finding, not an inconvenience.

**Customer support.** The refund window was 30 days and is now 14. The old article is still indexed. Money leaves at volume, invisibly.

**Engineering runbooks.** The deploy procedure changed eight months ago. At 3am the assistant hands someone the old one.

**Deprecated APIs.** Every developer has had a model confidently recommend a method removed two versions back.

**Sales and account intelligence.** The champion left, the budget changed at renewal, the competitor was displaced.

**Point-in-time reconstruction.** The differentiated one. Not "do not be wrong today" but "prove what was known, when."

Booth tactic: do not recite the list. Ask what they are building, then pick the one that matches and describe it back in their vocabulary.

---

## Open decision

Corpus — MongoDB's own history, or a neutral open-source project. Everything else follows from it.
