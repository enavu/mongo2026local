# Memory That Corrects Itself

Agent memory on MongoDB Atlas that knows when it was wrong.

Vector search has no concept of time. When a fact is revised, the old version stays in the index — and stays semantically near-identical to its correction, which is exactly why similarity cannot separate them. Agent memory built on vector recall alone returns superseded facts with high confidence, indefinitely.

This keeps vectors, relationships, and timestamps in a single Atlas collection, so one aggregation can tell the difference between what was true and what is.

```
$vectorSearch   →   recall, including the stale fact
$graphLookup    →   walk the edges, surface the correction
$sort           →   demote what has been superseded
```

Because superseded memories are retained rather than deleted, the system can also answer a question a plain vector store cannot: *what did this believe on 3 March?*

Demoed at MongoDB .local NYC, 30 September 2026, Champions booth.

See [SPEC.md](SPEC.md).
