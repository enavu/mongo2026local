import { mkdir, writeFile } from 'node:fs/promises';
import { env, pipeline } from '@huggingface/transformers';
import { memories, scenarios } from '../src/data/demo.js';

const MODEL = 'Xenova/all-MiniLM-L6-v2';

env.allowRemoteModels = false;
env.localModelPath = 'models';

const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const norm = (v) => { const m = Math.sqrt(dot(v, v)) || 1; return v.map((x) => x / m); };

function powerIteration(matrix, iterations = 200) {
  const n = matrix.length;
  let vector = norm(Array.from({ length: n }, (_, i) => Math.sin(i + 1)));
  for (let step = 0; step < iterations; step += 1) {
    const next = matrix.map((row) => dot(row, vector));
    vector = norm(next);
  }
  const lambda = dot(vector, matrix.map((row) => dot(row, vector)));
  return { vector, lambda };
}

// PCA on n<<d via the n-by-n Gram matrix; returns 2D points and the projection basis.
function project2d(vectorsById) {
  const ids = Object.keys(vectorsById);
  const rows = ids.map((id) => vectorsById[id]);
  const n = rows.length;
  const d = rows[0].length;
  const mean = new Array(d).fill(0);
  for (const row of rows) for (let j = 0; j < d; j += 1) mean[j] += row[j] / n;
  const centered = rows.map((row) => row.map((value, j) => value - mean[j]));
  const gram = centered.map((a) => centered.map((b) => dot(a, b)));
  const first = powerIteration(gram);
  const deflated = gram.map((row, i) => row.map((value, k) =>
    value - first.lambda * first.vector[i] * first.vector[k]));
  const second = powerIteration(deflated);
  const axis = (u) => {
    const w = new Array(d).fill(0);
    for (let i = 0; i < n; i += 1) for (let j = 0; j < d; j += 1) w[j] += u[i] * centered[i][j];
    return norm(w);
  };
  const w1 = axis(first.vector);
  const w2 = axis(second.vector);
  const points = {};
  ids.forEach((id, i) => { points[id] = [dot(centered[i], w1), dot(centered[i], w2)]; });
  return { mean, w1, w2, points };
}

async function main() {
  const embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  const vectorOf = async (text) => {
    const output = await embed(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  };
  const documents = {};
  for (const memory of memories) documents[memory._id] = await vectorOf(memory.text);
  const questions = {};
  for (const scenario of scenarios) questions[scenario.id] = await vectorOf(scenario.question);
  const dims = documents[memories[0]._id].length;
  const projection = project2d(documents);
  const meta = Object.fromEntries(memories.map((memory) => [memory._id, {
    subject: memory.subject, title: memory.title,
    kind: memory.answer ? (memory.supersedes.length ? 'correction' : 'fact') : 'related',
  }]));
  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/embeddings.json',
    `${JSON.stringify({ model: MODEL, dims, documents, questions, projection, meta }, null, 2)}\n`);
  console.log(`Wrote ${memories.length} document and ${scenarios.length} question vectors (${dims} dims), with 2D projection.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
