import { MongoClient } from 'mongodb';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env, pipeline } from '@huggingface/transformers';
import { expandMemories, resolveMemories } from '../src/lib/resolve.js';
import { memories } from '../src/data/demo.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
env.allowRemoteModels = false;
env.localModelPath = join(root, 'models');
const MODEL = 'Xenova/all-MiniLM-L6-v2';

let embedder;
let docVectors;
let projection;
let vectorMeta;

async function loadEmbeddings() {
  if (!projection) {
    const data = JSON.parse(await readFile(join(root, 'src/data/embeddings.json'), 'utf8'));
    docVectors = data.documents;
    projection = data.projection;
    vectorMeta = data.meta;
  }
  return { docVectors, projection, vectorMeta };
}

function projectVector(vector) {
  if (!projection) return null;
  const centered = vector.map((value, index) => value - projection.mean[index]);
  return [dot(centered, projection.w1), dot(centered, projection.w2)];
}

export async function getVectors() {
  const { projection: proj, vectorMeta: meta } = await loadEmbeddings();
  const points = Object.entries(proj.points).map(([id, xy]) => ({ id, x: xy[0], y: xy[1], ...meta[id] }));
  return { points };
}

async function embedText(text) {
  if (!embedder) embedder = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function loadDocVectors() {
  const { docVectors: vectors } = await loadEmbeddings();
  return vectors;
}

const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);

// Below this top-hit similarity, treat the question as out of scope rather than force a match.
const RELEVANCE_FLOOR = 0.68;
const noSource = (text, mode, durationMs) => ({
  state: 'empty', reason: 'No confidently related source. Try a MongoDB command, method, or version.',
  evidence: [], supersededIds: [], terminals: [], selected: null, baseline: null,
  mode, durationMs, question: text,
});

// A typed question has no scenario; adopt the top hit's subject and treat now as the cutoff.
function syntheticScenario(topHit) {
  const today = new Date().toISOString().slice(0, 10);
  return { subject: topHit.subject, scope: topHit.scope, effectiveAt: today, knownAt: today, baselineId: topHit._id };
}

const AGG_SHAPE = `[
  { $vectorSearch: { index: "mem_vec", path: "embedding",
      queryVector: <question>, numCandidates: 100, limit: 5,
      filter: { subject, scope } } },
  { $set: { score: { $meta: "vectorSearchScore" } } },
  { $graphLookup: { from: "memories", startWith: "$_id",
      connectFromField: "_id", connectToField: "supersedes",
      as: "corrections", maxDepth: 8,
      restrictSearchWithMatch: { subject, scope } } }
]`;

let client;
let indexReady = false;

export const queryShape = AGG_SHAPE;

export async function connect(uri, dbName) {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
  await client.connect();
  const collection = client.db(dbName).collection('memories');
  const indexes = await collection.listSearchIndexes().toArray().catch(() => []);
  indexReady = indexes.some((index) => index.name === 'mem_vec' && index.queryable);
  return { indexReady };
}

const normalize = (record) => ({ ...record,
  effective_at: new Date(record.effective_at).toISOString().slice(0, 10),
  recorded_at: new Date(record.recorded_at).toISOString().slice(0, 10),
  retrieved_at: record.retrieved_at ? new Date(record.retrieved_at).toISOString().slice(0, 10) : undefined });

export async function runMongo(scenario, queryVector, dbName) {
  if (!client) throw new Error('not-connected');
  await loadEmbeddings();
  const collection = client.db(dbName).collection('memories');
  const started = performance.now();
  const hits = await collection.aggregate([
    { $vectorSearch: { index: 'mem_vec', path: 'embedding', queryVector,
      numCandidates: 100, limit: 5,
      filter: { subject: scenario.subject, scope: scenario.scope } } },
    { $set: { score: { $meta: 'vectorSearchScore' } } },
    { $graphLookup: { from: 'memories', startWith: '$_id',
      connectFromField: '_id', connectToField: 'supersedes', as: 'corrections',
      maxDepth: 8, restrictSearchWithMatch: { subject: scenario.subject, scope: scenario.scope } } },
  ]).toArray();
  const rows = hits.map((hit) => ({ ...normalize(hit),
    corrections: (hit.corrections ?? []).map(normalize) }));
  const resolved = resolveMemories(rows, scenario);
  return { ...resolved, mode: 'mongodb', durationMs: Math.round(performance.now() - started), queryPoint: projectVector(queryVector) };
}

export async function askMongo(text, dbName) {
  if (!client) throw new Error('not-connected');
  await loadEmbeddings();
  const collection = client.db(dbName).collection('memories');
  const started = performance.now();
  const queryVector = await embedText(text);
  const hits = await collection.aggregate([
    { $vectorSearch: { index: 'mem_vec', path: 'embedding', queryVector, numCandidates: 100, limit: 8 } },
    { $set: { score: { $meta: 'vectorSearchScore' } } },
    { $graphLookup: { from: 'memories', startWith: '$_id',
      connectFromField: '_id', connectToField: 'supersedes', as: 'corrections', maxDepth: 8 } },
  ]).toArray();
  if (!hits.length) return noSource(text, 'mongodb', Math.round(performance.now() - started));
  const rows = hits.map((hit) => ({ ...normalize(hit), corrections: (hit.corrections ?? []).map(normalize) }));
  if ((rows[0].score ?? 0) < RELEVANCE_FLOOR) return noSource(text, 'mongodb', Math.round(performance.now() - started));
  const scenario = syntheticScenario(rows[0]);
  const resolved = resolveMemories(rows, scenario);
  return { ...resolved, mode: 'mongodb', durationMs: Math.round(performance.now() - started), question: text, subject: scenario.subject, queryPoint: projectVector(queryVector) };
}

export async function searchChangelog(text, dbName, limit = 6) {
  if (!client) throw new Error('not-connected');
  await loadEmbeddings();
  const collection = client.db(dbName).collection('changelog');
  const started = performance.now();
  const queryVector = await embedText(text);
  const hits = await collection.aggregate([
    { $vectorSearch: { index: 'chlog_vec', path: 'embedding', queryVector, numCandidates: 150, limit } },
    { $project: { _id: 0, title: 1, version: 1, effective_at: 1, source: 1,
      score: { $meta: 'vectorSearchScore' } } },
  ]).toArray();
  return {
    durationMs: Math.round(performance.now() - started),
    results: hits.map((hit) => ({
      title: hit.title,
      version: hit.version ?? null,
      date: hit.effective_at ? new Date(hit.effective_at).toISOString().slice(0, 10) : null,
      url: hit.source?.url ?? null,
      score: hit.score,
    })),
  };
}

export function runRehearsal(scenario, queryVector) {
  const hit = memories.find((record) => record._id === scenario.baselineId);
  const related = memories.filter((record) => record.relates_to.includes(scenario.baselineId));
  const seeds = [hit, ...related].filter(Boolean).map((record, index) => ({ ...record, score: 0.94 - index * 0.03 }));
  const rows = expandMemories(seeds, memories, scenario);
  return { ...resolveMemories(rows, scenario), mode: 'rehearsal', durationMs: null, queryPoint: queryVector ? projectVector(queryVector) : null };
}

export async function askRehearsal(text) {
  const vectors = await loadDocVectors();
  const queryVector = await embedText(text);
  const scored = memories
    .filter((record) => vectors[record._id])
    .map((record) => ({ ...record, score: dot(queryVector, vectors[record._id]) }))
    .sort((left, right) => right.score - left.score);
  if (!scored.length) return noSource(text, 'rehearsal', null);
  if (scored[0].score < RELEVANCE_FLOOR) return noSource(text, 'rehearsal', null);
  const scenario = syntheticScenario(scored[0]);
  const rows = expandMemories(scored.slice(0, 8), memories, scenario);
  return { ...resolveMemories(rows, scenario), mode: 'rehearsal', durationMs: null, question: text, subject: scenario.subject, queryPoint: projectVector(queryVector) };
}

export async function close() { await client?.close(); }
