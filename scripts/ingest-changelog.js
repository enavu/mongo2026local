// Ingest real MongoDB changelog markdown into vector documents (offline embeddings).
// Bulk vectors only: no supersession edges are inferred here. Edges stay curated.
import { mkdir, writeFile } from 'node:fs/promises';
import { env, pipeline } from '@huggingface/transformers';

env.allowRemoteModels = false;
env.localModelPath = 'models';
const MODEL = 'Xenova/all-MiniLM-L6-v2';

const SOURCES = [
  // 9.0 is listed ahead of release; the ingester skips it until the page exists.
  { url: 'https://www.mongodb.com/docs/manual/release-notes/9.0.md', title: 'MongoDB 9.0 Release Notes' },
  { url: 'https://www.mongodb.com/docs/manual/release-notes/8.0.md', title: 'MongoDB 8.0 Release Notes' },
  { url: 'https://www.mongodb.com/docs/manual/release-notes/7.0.md', title: 'MongoDB 7.0 Release Notes' },
  { url: 'https://www.mongodb.com/docs/manual/release-notes/8.0-compatibility.md', title: 'MongoDB 8.0 Compatibility Changes' },
  { url: 'https://www.mongodb.com/docs/manual/release-notes/7.0-compatibility.md', title: 'MongoDB 7.0 Compatibility Changes' },
  { url: 'https://www.mongodb.com/docs/mongodb-shell/changelog.md', title: 'mongosh Changelog' },
];

const MAX_PER_SOURCE = 500;
const MIN_CHARS = 60;

// Content-free changelog stubs (mostly mongosh "internal improvements … on JIRA").
const NOISE = /available on jira|internal (enhancements|improvements)|no changes|minor (fixes|improvements)/i;

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function clean(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(text) {
  const match = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) return null;
  const month = match[1].slice(0, 3);
  const date = new Date(`${month} ${match[2]}, ${match[3]}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseVersion(text) {
  const match = text.match(/(\d+\.\d+(?:\.\d+)?)/);
  return match ? match[1] : null;
}

function chunkMarkdown(markdown, source) {
  const lines = markdown.split('\n');
  const chunks = [];
  let heading = null;
  let body = [];
  const flush = () => {
    if (!heading) return;
    const text = clean(body.join(' '));
    if (text.length >= MIN_CHARS && !NOISE.test(text)) {
      chunks.push({ heading: clean(heading), text: `${clean(heading)}. ${text}`.slice(0, 900) });
    }
    body = [];
  };
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.*)$/);
    if (match) { flush(); heading = match[2]; } else if (heading) { body.push(line); }
  }
  flush();
  return chunks.slice(0, MAX_PER_SOURCE).map((chunk, index) => ({
    _id: `${slug(source.title)}-${index}`,
    kind: 'changelog',
    subject: source.title,
    title: chunk.heading,
    text: chunk.text,
    source: { title: source.title, url: source.url, section: chunk.heading },
    version: parseVersion(chunk.heading),
    effective_at: parseDate(chunk.heading),
    retrieved_at: new Date().toISOString().slice(0, 10),
  }));
}

async function main() {
  const embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  const vectorOf = async (text) => {
    const output = await embed(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  };

  const docs = [];
  for (const source of SOURCES) {
    const response = await fetch(source.url);
    if (!response.ok) { console.warn(`skip ${source.url}: ${response.status}`); continue; }
    const markdown = await response.text();
    const chunks = chunkMarkdown(markdown, source);
    console.log(`${source.title}: ${chunks.length} chunks`);
    docs.push(...chunks);
  }

  let done = 0;
  for (const doc of docs) {
    doc.embedding = await vectorOf(doc.text);
    done += 1;
    if (done % 25 === 0) console.log(`embedded ${done}/${docs.length}`);
  }
  const dims = docs[0]?.embedding.length ?? 0;
  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/changelog.json',
    `${JSON.stringify({ model: MODEL, dims, count: docs.length, docs }, null, 2)}\n`);
  console.log(`Wrote ${docs.length} changelog chunks (${dims} dims) to src/data/changelog.json`);
}

main().catch((error) => { console.error(error); process.exit(1); });
