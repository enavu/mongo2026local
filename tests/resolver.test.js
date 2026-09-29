import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios, memories } from '../src/data/demo.js';
import { expandMemories, isApplicable, MAX_DEPTH, resolveMemories } from '../src/lib/resolve.js';

function run(scenario, corpus = memories) {
  const hit = corpus.find((record) => record._id === scenario.baselineId);
  const related = corpus.filter((record) => record.relates_to.includes(scenario.baselineId));
  const seeds = [hit, ...related].filter(Boolean).map((record, index) => ({ ...record, score: 0.94 - index * 0.03 }));
  return resolveMemories(expandMemories(seeds, corpus, scenario), scenario);
}

test('promotes a replacement that was absent from initial recall', () => {
  const result = run(scenarios[0]);
  assert.equal(result.selected._id, 'shell-mongosh');
  assert.equal(result.baseline._id, 'shell-mongo');
  assert.equal(result.selected.score, undefined);
  assert.ok(result.supersededIds.includes('shell-mongo'));
});

test('newer related guidance does not replace a claim', () => {
  const result = run(scenarios[0], memories.filter((record) => record._id !== 'shell-mongosh'));
  assert.equal(result.selected._id, 'shell-mongo');
  assert.ok(result.evidence.some((record) => record._id === 'shell-editor'));
  assert.ok(!result.supersededIds.includes('shell-mongo'));
});

test('resolves the Atlas CLI deprecation to atlas local', () => {
  const result = run(scenarios[1]);
  assert.equal(result.selected._id, 'cli-local');
  assert.ok(result.supersededIds.includes('cli-deployments'));
});

test('competing terminal claims require review', () => {
  const result = run(scenarios[2]);
  assert.equal(result.state, 'conflict');
  assert.equal(result.selected, null);
  assert.equal(result.terminals.length, 2);
});

test('resolves map-reduce to the aggregation pipeline', () => {
  const scenario = scenarios.find((item) => item.id === 'mapreduce');
  const result = run(scenario);
  assert.equal(result.selected._id, 'mr-aggregation');
  assert.ok(result.supersededIds.includes('mr-mapreduce'));
});

test('count resolves to countDocuments with estimated as related only', () => {
  const scenario = scenarios.find((item) => item.id === 'count');
  const result = run(scenario);
  assert.equal(result.selected._id, 'count-documents');
  assert.ok(result.supersededIds.includes('count-legacy'));
  assert.ok(result.evidence.some((record) => record._id === 'count-estimated' && !record.answer));
});

test('future-effective and not-yet-known amendments are excluded', () => {
  assert.equal(run({ ...scenarios[0], effectiveAt: '2021-07-12' }).selected._id, 'shell-mongo');
  assert.equal(run({ ...scenarios[0], knownAt: '2021-07-12' }).selected._id, 'shell-mongo');
  assert.equal(run({ ...scenarios[0], effectiveAt: '2021-07-13' }).selected._id, 'shell-mongosh');
});

test('wrong scope and invalid dates cannot establish applicability', () => {
  assert.equal(isApplicable({ ...memories[0], scope: 'another-tenant' }, scenarios[0]), false);
  assert.equal(isApplicable({ ...memories[0], effective_at: 'invalid' }, scenarios[0]), false);
  assert.equal(run({ ...scenarios[0], scope: 'another-tenant' }).state, 'empty');
});

test('cycles do not produce a winner', () => {
  const corpus = memories.map((record) => record._id === 'shell-mongo'
    ? { ...record, supersedes: ['shell-mongosh'] } : record);
  assert.equal(run(scenarios[0], corpus).state, 'invalid');
  assert.equal(run(scenarios[0], corpus).selected, null);
});

test('empty recall produces no answer', () => {
  const result = resolveMemories([], scenarios[0]);
  assert.equal(result.state, 'empty');
  assert.equal(result.selected, null);
});

test('depth-boundary results cannot masquerade as a completed chain', () => {
  const base = memories.find((record) => record._id === 'shell-mongo');
  const correction = memories.find((record) => record._id === 'shell-mongosh');
  const result = resolveMemories([{ ...base, corrections: [{ ...correction, depth: MAX_DEPTH }] }], scenarios[0]);
  assert.equal(result.state, 'invalid');
});

test('duplicate expansion preserves one evidence record per ID', () => {
  const base = memories.find((record) => record._id === 'shell-mongo');
  const correction = memories.find((record) => record._id === 'shell-mongosh');
  const rows = expandMemories([base, correction], memories, scenarios[0]);
  assert.equal(resolveMemories(rows, scenarios[0]).evidence.length, 2);
});
