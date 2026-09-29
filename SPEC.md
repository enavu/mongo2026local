---
title: "Memory That Corrects Itself: Agent Memory on Atlas"
description: MongoDB changelog memory demo, execution states, and acceptance criteria.
---

## Demo contract

MongoDB .local NYC, 30 September 2026. Five minutes, repeated at the Champions booth.
Laptop presentation, no live model calls. Use MongoDB release notes, changelogs,
and versioned documentation as the memory corpus. Hosted Atlas execution needs
connectivity; prepare a verified local deployment and recording for offline use.

Audience promise: stop AI using yesterday's rules. Show a changed decision, its
source, and the exact replacement relationship before showing database operators.

Similarity alone does not establish which fact applies. This demo uses curated,
authoritative supersession relationships and deterministic resolution. It does
not discover contradictions automatically or demonstrate an autonomous agent.
Similarity scores are not truth confidence. Other vector databases can store
temporal metadata; MongoDB's benefit here is storing documents, vectors, and
relationships together, without an application-managed cross-store sync job.
Search indexing can still lag behind document writes.

## Audience and corpus

MongoDB's documented evolution supplies the memory. An earlier recommendation
can remain relevant to a question while a later release changes which guidance
applies to the selected product and version. These are source documents, not
MongoDB Change Streams or a database event log.

Prepare three fixed questions from verified sources:

* A documented deprecation changes the answer after traversal (shell: the legacy
  `mongo` shell was deprecated in v5.0; `mongosh` replaced it).
* A second documented deprecation confirms the pattern generalizes (Atlas CLI:
  `atlas deployments` was deprecated in Atlas CLI 1.52.0; use `atlas local`).
* Two current sources give different answers with no replacement between them
  (Vector Search minimum version: ANN needs v6.0.11/v7.0.2+, ENN needs
  v6.0.16/v7.0.10/v7.3.2+), so the system returns review required.

The built corpus lives in `src/data/demo.js`. Each record carries a source URL,
section, product/version applicability, retrieval date, and, for every
supersession edge, the documented quote that justifies it. A verified multi-hop
revision chain is deferred until a suitable multi-step source is sourced and
quoted; the same resolver handles it without code changes.

Each memory needs a source URL, document title, section, short supporting excerpt,
product/version applicability, and retrieval date. Preserve local source snapshots
for offline inspection. Distinguish the source publication or effective date from
the date it entered the demo corpus; do not invent missing dates.

Create a supersession edge only after checking that the later source replaces the
same claim under matching applicability. Release chronology alone is not proof.
Older guidance may remain correct for older versions. Curated edges must expose
their supporting evidence in the source inspector.

The proposed arrays-of-embeddings/nestedRoot contradiction is unverified and not
accepted demo evidence. Only show conflicting documentation after verifying
matching product, version, and scope. Otherwise keep conflicts as labeled test
fixtures, not claims about MongoDB documentation.

Contracts, customer support, regulatory guidance, and engineering runbooks are
business applications to explain verbally. They do not replace the MongoDB corpus.
The existing fictional scenarios remain development fixtures until verified source
records, questions, and embeddings replace them in the audience-facing demo.

## Local architecture

Do not use Tilt for the booth build. There is no Kubernetes dependency or
multi-service deployment to coordinate. Use npm commands for the app and Atlas
CLI or a local Atlas container for MongoDB. Reconsider Tilt only if the project
grows into multiple independently deployed services already managed by Tilt.

* React and Vite provide the local visual application.
* A Node API owns MongoDB access. Credentials never reach the browser.
* One `memories` collection holds records, vectors, and typed relationships.
* The MongoDB driver runs vector recall followed by graph traversal.
* A shared deterministic resolver promotes terminal replacements into answers.
* An explicit rehearsal mode uses fixed recall fixtures and local traversal.

Hosted Atlas is the target deployment. Verify the composed aggregation and vector
index on the selected tier/version before claiming Atlas execution. A compatible
local deployment supports offline MongoDB execution, not proof of hosted Atlas.
Precompute embeddings for reproducibility; auto-embedding is not a prerequisite.

Rehearsal mode must say that results are fixtures. It is not proof of MongoDB
execution. MongoDB mode must expose a real execution duration and fail visibly
when unavailable; it must never silently switch to fixtures.

## Visual application

Build the usable demo as the first screen, not a landing page. Use a restrained
workspace with a prominent question, scenario selection, three numbered stages,
evidence records, and a before/after decision. Keep typography readable at booth
distance. Use a linear source history instead of a force-directed graph.

Required controls and states:

* Scenario selection resets progression and clears old results.
* Recall, Trace, and Resolve have distinct selected and completed states.
* Next, back, and reset support a repeatable walkthrough.
* Source inspection shows cited excerpts, URLs, product/version applicability,
  retrieval dates, identity, and evidence supporting each replacement relationship.
* A query view shows the actual MongoDB aggregation shape.
* Loading, empty, unavailable, and unresolved states are explicit.
* Rehearsal and MongoDB modes remain visibly distinguishable.
* All fonts, icons, source excerpts, and browser assets are served locally.
* Desktop and mobile layouts work without clipping or horizontal page scrolling.

Answers are deterministic renderings of selected source records, not LLM output.
The fixed scenarios use precomputed question vectors. Visitors may also type a
question: the local embedding model (`models/`, no network, no LLM) embeds it in
the Node API and runs the same recall and resolution. A relevance floor returns
an honest no-source state when the top hit is weak, so off-topic questions do not
force a wrong answer.

## Data and resolution rules

Use stable string IDs in the small seed corpus. MongoDB stores dates as BSON dates.
The following shape uses placeholders, not verified MongoDB facts. Final source
records must be grounded in inspected documentation before seeding.

```js
{
  _id: "shell-mongosh",
  subject: "shell-choice",
  scope: "mongodb-server",
  text: "The mongo shell has been deprecated in MongoDB v5.0. The replacement is mongosh...",
  answer: "Use mongosh; the legacy mongo shell was deprecated in v5.0.",
  effective_at: verifiedEffectiveDate,
  recorded_at: corpusIngestionDate,
  retrieved_at: sourceRetrievalDate,
  source: {
    title: "MongoDB Shell (mongosh)",
    url: "https://www.mongodb.com/docs/mongodb-shell/",
    section: "Welcome to mongosh",
    product_version: "MongoDB Server 5.0+",
    retrieved_at: sourceRetrievalDate
  },
  supersedes: ["shell-mongo"],
  supersedes_evidence: {
    "shell-mongo": "The mongo shell has been deprecated in MongoDB v5.0. The replacement is mongosh."
  },
  relates_to: [],
  embedding: [0.1, 0.2]
}
```

The example vector is illustrative, not a production embedding. Store the chosen
embedding model, dimensions, and query vectors with the generated corpus artifact.

1. Filter by trusted scenario subject, product/version scope, effective date, and
  knowledge cutoff. Apply version applicability before allowing supersession;
  do not use lexical version ordering or dates as substitutes for version checks.
2. Recall candidate documents with `$vectorSearch` and extract
  `score: { $meta: "vectorSearchScore" }` before graph expansion.
3. Reverse-traverse only `supersedes`, using `_id` as `connectFromField` and
  `supersedes` as `connectToField`. Apply the same applicability constraints.
4. Deduplicate recalled and expanded records; only explicit replacement edges
  invalidate a fact. `relates_to` never changes authority.
5. Resolve each chain to its terminal applicable record, including replacements
  absent from the initial hits. Do not assign them invented similarity scores.
6. Multiple terminal claims require review. Missing evidence, cycles, or a
  truncated chain must not produce a confident winner.

Keep superseded documents. Do not treat newest timestamp as automatic authority.
Use an index on `supersedes` and vector filter indexes for applicability fields.
Bound traversal for the curated corpus and reject results at the depth boundary
rather than silently treating a partial chain as complete.

The MVP uses one MongoDB aggregation for retrieval and expansion, then an explicit
application resolver. Do not claim the complete decision runs inside MongoDB.
Any future all-aggregation implementation must pass the same behavioral tests.

## Five-minute walkthrough

| Time | Action | Visible state | Evidence of success |
| --- | --- | --- | --- |
| 0:00-0:30 | Select verified MongoDB question | Product, version, cutoff, execution mode | No answer from a previous run |
| 0:30-1:30 | Recall | Earlier guidance and similarity scores | Baseline answer uses the outdated guidance |
| 1:30-2:30 | Trace | Cited replacement and explicit path | Correction is shown even if absent from recall |
| 2:30-3:30 | Resolve | Answer appropriate to selected product/version | Source citation and stale-guidance annotation agree |
| 3:30-4:00 | Inspect newer related documentation | Source with no replacement edge | Newness alone does not select an answer |
| 4:00-4:30 | Show the conflict question | Two current, non-superseding sources | Competing claims return review required, not a guess |
| 4:30-5:00 | Show query, then reset | MongoDB operators, execution mode, cleared state | Attendee sees how to reproduce it |

For commercial audiences, explain how the same replacement relationship models a
contract amendment or policy revision. Keep the demonstrated evidence unchanged.
Any point-in-time view reconstructs applicable recorded guidance, not what an
agent historically believed or returned. That requires persisted execution records.

## Implementation plan

| Phase | Deliverable | Required check |
| --- | --- | --- |
| 1 | Verified MongoDB sources, corpus, applicability filters, graph resolution | Source review plus tests for replacement, related-only, multi-hop, conflict, versions, dates, cycles, and missing data |
| 2 | Local API and rehearsal mode | API validation, explicit mode, failure behavior, deterministic results |
| 3 | Visual walkthrough and source inspector | Browser tests for all stages, scenarios, reset, source and query views |
| 4 | Atlas seed and aggregation, compatible offline deployment | Integration tests on each claimed deployment; actual scores, corrections, and decisions |
| 5 | Offline booth rehearsal | Restart without Wi-Fi, repeated walkthroughs, timing, fallback recording |

## Definition of done

A demo step is done only when its starting state, action, resulting visible state,
and pass/fail evidence are recorded. A screenshot proves appearance, not database
execution. A passing rehearsal fixture does not complete a MongoDB integration gate.

| Gate | Pass condition |
| --- | --- |
| Source evidence | Every audience-facing fact and replacement edge has inspected MongoDB citations and product/version applicability |
| Recall | Baseline retains the stale source; displayed scores match the selected execution mode |
| Trace | A correction absent from initial recall appears through a supersession edge |
| Resolve | Replacement, not another unrelated original hit, determines the answer |
| Related source | Newer related MongoDB documentation cannot supersede guidance without a verified replacement edge |
| Multi-hop | The applicable terminal MongoDB guidance wins across two verified edges |
| Conflict | Competing terminal claims produce review required, not a synthesized answer |
| Applicability | Future-effective, not-yet-known, wrong-product, and wrong-version records cannot change the answer |
| Invalid graph | Cycles, incomplete traversal, and empty evidence cannot produce a winner |
| Navigation | Back, scenario change, mode change, and reset cannot leave stale answer content |
| Accessibility | Controls work by keyboard; focus is visible; dialogs close and restore focus |
| Responsive UI | Desktop and mobile screenshots show readable content without overlap |
| Local MongoDB | Integration tests pass against the selected image/version and vector index |
| Hosted Atlas | Integration tests pass against the selected Atlas tier/version and vector index |
| Offline restart | Cached deployment and built app restart with Wi-Fi disabled and no external requests |
| Repeatability | Ten complete walkthrough/reset cycles produce the expected results |
| Booth readiness | Five-minute spoken rehearsal and two-minute local fallback recording completed |

Track automated results and uncompleted manual gates in the README. Do not mark
unexecuted checks as passed. The visual application may be ready for rehearsal
while the MongoDB and physical booth checks remain pending.

## Operational checklist

* Pin the tested Node, package lock, embedding model, and MongoDB image/version.
* Download images and dependencies before travel. Seed documents and indexes early.
* Precompute document and question embeddings using the same model configuration.
* Check vector index readiness and run the exact booth questions after seeding.
* Keep MongoDB and the app bound to loopback. Do not expose credentials in logs.
* Record actual latency and dataset size; do not present fixture timings as database benchmarks.
* Disable Wi-Fi and rehearse a cold restart, not only an already-open browser tab.
* Store the recording locally; a cloud link alone is not an offline fallback.

## Explicit exclusions

No live LLM, automatic contradiction discovery, hybrid search,
Kubernetes, or Tilt. No claims of complete auditability, historical agent beliefs,
or zero indexing lag. Free-text uses a local embedding model, not automated
Atlas embedding; Voyage-based auto-embedding remains out of scope offline.
Effective and recorded dates support applicability checks; full bitemporal
history and persisted execution audit records are later work.

Production work also requires permission-scoped recall and traversal, reviewed
edge creation, partial amendments, retractions, and ingestion validation. The
public-document, single-user demo does not demonstrate these production controls.
