export const MAX_DEPTH = 8;

export function isApplicable(memory, scenario) {
  return memory.subject === scenario.subject
    && memory.scope === scenario.scope
    && new Date(memory.effective_at).getTime() <= new Date(scenario.effectiveAt).getTime()
    && new Date(memory.recorded_at).getTime() <= new Date(scenario.knownAt).getTime();
}

export function expandMemories(hits, corpus, scenario) {
  return hits.filter((hit) => isApplicable(hit, scenario)).map((hit) => {
    const corrections = new Map();
    let frontier = [hit._id];
    for (let depth = 0; depth <= MAX_DEPTH && frontier.length; depth += 1) {
      const next = corpus.filter((record) => isApplicable(record, scenario)
        && record.supersedes.some((id) => frontier.includes(id))
        && !corrections.has(record._id));
      for (const record of next) corrections.set(record._id, { ...record, depth });
      frontier = next.map((record) => record._id);
    }
    return { ...hit, corrections: [...corrections.values()] };
  });
}

export function resolveMemories(rows, scenario) {
  const records = new Map();
  const applicableRows = rows.filter((row) => isApplicable(row, scenario));
  let truncated = false;
  for (const row of applicableRows) {
    const { corrections = [], ...hit } = row;
    records.set(hit._id, hit);
    for (const correction of corrections.filter((record) => isApplicable(record, scenario))) {
      if (correction.depth >= MAX_DEPTH) truncated = true;
      if (!records.has(correction._id)) records.set(correction._id, correction);
    }
  }

  const evidence = [...records.values()].sort((left, right) =>
    new Date(left.effective_at) - new Date(right.effective_at) || left._id.localeCompare(right._id));
  const visited = new Set();
  const active = new Set();
  function hasCycle(id) {
    if (active.has(id)) return true;
    if (visited.has(id)) return false;
    active.add(id);
    for (const parent of records.get(id)?.supersedes ?? []) {
      if (records.has(parent) && hasCycle(parent)) return true;
    }
    active.delete(id);
    visited.add(id);
    return false;
  }
  const cyclic = evidence.some((record) => hasCycle(record._id));
  const supersededIds = [...new Set(evidence.flatMap((record) => record.supersedes))];
  const terminals = evidence.filter((record) => record.answer && !supersededIds.includes(record._id));
  let state = 'resolved';
  let reason = 'An explicit replacement chain establishes the applicable source.';
  if (!evidence.length || !terminals.length) {
    state = 'empty';
    reason = 'No applicable terminal claim is available.';
  }
  if (terminals.length > 1) {
    state = 'conflict';
    reason = 'Multiple applicable claims remain without a replacement relationship between them.';
  }
  if (cyclic || truncated) {
    state = 'invalid';
    reason = cyclic ? 'A replacement cycle requires review.' : 'The traversal reached its depth limit; completion is not established.';
  }
  return {
    state, reason, evidence, supersededIds,
    terminals, selected: state === 'resolved' ? terminals[0] : null,
    baseline: applicableRows.find((record) => record.answer) ?? null,
  };
}