---
title: "Memory That Corrects Itself: Agent Memory on Atlas"
description: Agent-memory demo grounded in MongoDB changelogs and documented revisions.
---

## Demo

Planned for MongoDB .local NYC, 30 September 2026, Champions booth.

MongoDB release notes, changelogs, and versioned documentation supply the memory.
Vector recall can retrieve outdated guidance because similarity alone does not
establish applicability. Explicit, source-verified replacement relationships let
the demo surface the guidance appropriate to a selected product and version.

Documents, vectors, timestamps, and relationships share one collection:

```text
$vectorSearch        -> recall, including outdated guidance
$graphLookup         -> reverse-traverse verified replacement links
Application resolver -> select applicable terminal guidance or require review
```

Retrieval and expansion use one aggregation; final resolution runs in application
code. Scores measure similarity, not truth confidence. Search indexing can lag
behind writes. Retained records support point-in-time applicability checks, not
proof of historical agent beliefs without execution records.

Hosted Atlas is the target. No live model calls are required. Hosted execution
needs connectivity; a tested local MongoDB deployment and local recording provide
offline alternatives. Rehearsal fixtures are labeled and never presented as proof
of database execution.

## Current status

* The corpus is verified MongoDB documentation, held in `src/data/demo.js`.
* Three questions ship: two documented deprecations (legacy `mongo` shell to
  `mongosh`; `atlas deployments` to `atlas local`) and one genuine conflict
  (Vector Search minimum version differs for ANN and ENN), which returns review
  required rather than a guess.
* Every record cites a source URL, section, product/version, and retrieval date;
  each supersession edge carries the documented quote that justifies it.
* Visitors can type their own question. The local embedding model (`models/`,
  offline, no LLM) embeds it and runs the same recall and resolution; a relevance
  floor returns an honest no-source state for off-topic questions.
* Automated gates pass: resolver unit tests, local MongoDB integration
  (`$vectorSearch` plus `$graphLookup` on a loopback Atlas container), and
  desktop and mobile browser walkthroughs.
* Pending manual gates: offline cold-restart rehearsal and the two-minute local
  fallback recording. A verified multi-hop revision chain is deferred until a
  suitable multi-step source is quoted.

## Run it

Atlas is the primary backend. Vector Search runs on a free (M0) or Flex cluster,
so point the demo at your own cluster and show it in the Atlas UI.

```bash
npm install
cp .env.example .env         # then paste your Atlas SRV string into .env
npm run embeddings           # local, offline: precompute vectors
npm run build
npm run seed                 # memories + mem_vec index on Atlas
npm run seed:changelog       # changelog corpus + chlog_vec index
npm run seed:compat          # compatibility + server_versions
npm run check:atlas          # verify connection, seeds, and index readiness
npm start                    # http://127.0.0.1:8137, backed by Atlas
```

The app and free-text box embed queries locally in Node; only the database lives
in Atlas. Allow a few seconds after each seed for the vector index to build.

### Offline fallback (optional)

Keep the local Atlas container only as a no-network backup. It runs the same
engine and indexes.

```bash
npm run db:up                # local Atlas container on 127.0.0.1:27779
# set MONGODB_URI to the loopback string (see .env.example), then seed as above
```

Without any MongoDB, `npm start` serves the app in rehearsal mode using fixed
recall fixtures. Rehearsal results are labeled and are not proof of database
execution. See [SPEC.md](SPEC.md) for scope, states, and acceptance criteria.

## Atlas console walkthrough

After seeding, in the Atlas UI:
  while the correction is pulled in by the edge.

## Changelog corpus in Atlas

To show vectors built from MongoDB's real changelog, ingest the release notes and
compatibility pages into a separate `changelog` collection:

```bash
npm run ingest:changelog   # fetches MongoDB 9.0/8.0/7.0 release notes,
                           # compatibility pages, and the mongosh changelog;
                           # chunks and embeds them locally (offline) into
                           # src/data/changelog.json
npm run seed:changelog     # loads the chunks and creates the chlog_vec index
npm run check:atlas        # also reports the changelog count and index readiness
```

This produces a few hundred real, dated changelog chunks (version and effective
date parsed from each release heading). In the Atlas console:

* Data Explorer, Collections, `changelog`: real release-note sections with
  `version`, `effective_at`, `source.url`, and the `embedding` field.
* Vector Search, Indexes: the `chlog_vec` index over the changelog embeddings.
* Data Explorer, Aggregation: run `$vectorSearch` on `chlog_vec` with a query
  vector and watch natural-language questions return the relevant changelog
  sections by meaning, not keywords.

Only vectors are built automatically from the changelog. Supersession edges are
not inferred from raw release notes; the curated, quote-verified edges in the
`memories` collection remain the source of the correction demo.

## Version drift check

Similarity finds the feature a question is about; version constraints decide
whether a given stack can actually run it. The `compatibility` records encode
only version minimums that can be cited from MongoDB documentation.

```bash
npm run drift                                      # example verdicts
npm run drift -- vectorSearch node 6.4.0 6.0.9     # feature driver driverVer serverVer
npm run drift -- vectorSearch "" "" 7.0.5 enn      # ENN server minimum
```

Each verdict reports whether the server and driver versions meet the documented
minimums, names the required version when they do not, and cites the source.
Version edges are curated and verified, never scraped from prose.
