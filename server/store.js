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

// --- Changelog galaxy: 2D projection of the whole changelog corpus + queries ---
let galaxy;

function pca2d(rows) {
  const n = rows.length;
  const d = rows[0].length;
  const mean = new Array(d).fill(0);
  for (const row of rows) for (let j = 0; j < d; j += 1) mean[j] += row[j] / n;
  const centered = rows.map((row) => row.map((value, j) => value - mean[j]));
  const gram = centered.map((a) => centered.map((b) => dot(a, b)));
  const normalize = (v) => { const m = Math.sqrt(dot(v, v)) || 1; return v.map((x) => x / m); };
  const power = (matrix, iterations = 160) => {
    let v = normalize(Array.from({ length: matrix.length }, (_, i) => Math.sin(i + 1)));
    for (let s = 0; s < iterations; s += 1) v = normalize(matrix.map((row) => dot(row, v)));
    return { v, lambda: dot(v, matrix.map((row) => dot(row, v))) };
  };
  const first = power(gram);
  const deflated = gram.map((row, i) => row.map((value, k) => value - first.lambda * first.v[i] * first.v[k]));
  const second = power(deflated);
  const axis = (u) => {
    const w = new Array(d).fill(0);
    for (let i = 0; i < n; i += 1) for (let j = 0; j < d; j += 1) w[j] += u[i] * centered[i][j];
    return normalize(w);
  };
  const w1 = axis(first.v);
  const w2 = axis(second.v);
  return { mean, w1, w2, points: centered.map((c) => [dot(c, w1), dot(c, w2)]) };
}

async function loadGalaxy() {
  if (galaxy) return galaxy;
  const data = JSON.parse(await readFile(join(root, 'src/data/changelog.json'), 'utf8'));
  const basis = pca2d(data.docs.map((doc) => doc.embedding));
  const points = data.docs.map((doc, i) => ({
    id: doc._id, x: basis.points[i][0], y: basis.points[i][1],
    version: doc.version, subject: doc.subject, title: doc.title,
  }));

  // Group by release and compute a centroid per release: a 2D position (same
  // basis as the points) and a normalized 384-d vector for true cosine distance.
  const relKey = (s) => {
    const t = String(s || '');
    if (t.includes('9.0')) return '9.0';
    if (t.includes('8.0')) return '8.0';
    if (t.includes('7.0')) return '7.0';
    return 'mongosh';
  };
  const groups = {};
  data.docs.forEach((doc) => { (groups[relKey(doc.subject)] ??= []).push(doc.embedding); });
  const dim = data.docs[0].embedding.length;
  const unit = {};
  const releases = [];
  for (const [key, vecs] of Object.entries(groups)) {
    const mean = new Array(dim).fill(0);
    vecs.forEach((v) => { for (let j = 0; j < dim; j += 1) mean[j] += v[j] / vecs.length; });
    const centered = mean.map((v, i) => v - basis.mean[i]);
    const m = Math.sqrt(dot(mean, mean)) || 1;
    unit[key] = mean.map((x) => x / m);
    releases.push({ key, x: dot(centered, basis.w1), y: dot(centered, basis.w2), count: vecs.length });
  }
  const order = ['7.0', '8.0', '9.0'];
  const separations = [];
  for (let i = 0; i < order.length; i += 1) {
    for (let j = i + 1; j < order.length; j += 1) {
      const a = order[i]; const b = order[j];
      if (unit[a] && unit[b]) separations.push({ a, b, cosine: dot(unit[a], unit[b]) });
    }
  }
  galaxy = { basis: { mean: basis.mean, w1: basis.w1, w2: basis.w2 }, points, releases, separations };
  return galaxy;
}

function projectGalaxy(vector) {
  if (!galaxy) return null;
  const centered = vector.map((value, i) => value - galaxy.basis.mean[i]);
  return [dot(centered, galaxy.basis.w1), dot(centered, galaxy.basis.w2)];
}

export async function changelogGalaxy() {
  const { points, releases, separations } = await loadGalaxy();
  return { points, releases, separations };
}

// Breaking/compatibility changes to review when upgrading to a target version,
// plus the non-breaking gains (new features, improvements), both from that
// version's compatibility page and release notes in Atlas.
export async function upgradeChanges(to, dbName) {
  if (!client) throw new Error('not-connected');
  const collection = client.db(dbName).collection('changelog');
  const escaped = to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const changes = await collection.find({
    $or: [
      { subject: new RegExp(`${escaped} Compatibility`, 'i') },
      { subject: new RegExp(`${escaped} Release`, 'i'), title: /incompat|deprecat|removed|breaking|compatib/i },
    ],
  }).project({ _id: 0, title: 1, text: 1, source: 1 }).toArray();

  const releaseDocs = await collection.find({ subject: new RegExp(`${escaped} Release`, 'i') })
    .project({ _id: 0, title: 1, text: 1, source: 1 }).toArray();
  const isPatch = (t) => /^\d+\.\d+\.\d+/.test(t);
  const isBreaking = (t) => /incompat|deprecat|removed|breaking|compatib/i.test(t);
  const isNoise = (t) => /known issues|general changes|report an issue/i.test(t);
  const gains = releaseDocs
    .filter((d) => !isPatch(d.title) && !isBreaking(d.title) && !isNoise(d.title))
    .slice(0, 12);

  const shape = (c) => ({ title: c.title, text: c.text ?? '', url: c.source?.url ?? null });
  return { to, count: changes.length, changes: changes.map(shape), gains: gains.map(shape) };
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
  await loadGalaxy();
  const collection = client.db(dbName).collection('changelog');
  const started = performance.now();
  const queryVector = await embedText(text);
  const hits = await collection.aggregate([
    { $vectorSearch: { index: 'chlog_vec', path: 'embedding', queryVector, numCandidates: 150, limit } },
    { $project: { _id: 1, title: 1, text: 1, version: 1, effective_at: 1, source: 1,
      score: { $meta: 'vectorSearchScore' } } },
  ]).toArray();
  return {
    durationMs: Math.round(performance.now() - started),
    queryPoint: projectGalaxy(queryVector),
    results: hits.map((hit) => ({
      id: hit._id,
      title: hit.title,
      text: hit.text ?? '',
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
