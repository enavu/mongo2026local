import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scenarios } from '../src/data/demo.js';
import { connect, runMongo, close } from '../server/store.js';

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27779/?directConnection=true';
const dbName = process.env.MONGODB_DB ?? 'memory_demo';

async function waitForIndex(attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    const status = await connect(uri, dbName).catch(() => ({ indexReady: false }));
    if (status.indexReady) return true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

test('live MongoDB aggregation resolves supersession end to end', async (t) => {
  const embeddings = JSON.parse(await readFile('src/data/embeddings.json', 'utf8'));
  const ready = await waitForIndex();
  if (!ready) {
    await close();
    t.skip('vector index not queryable in time');
    return;
  }
  t.after(() => close());

  const shell = scenarios[0];
  const result = await runMongo(shell, embeddings.questions[shell.id], dbName);
  assert.equal(result.mode, 'mongodb');
  assert.equal(result.selected._id, 'shell-mongosh');
  assert.ok(result.supersededIds.includes('shell-mongo'));
  assert.ok(typeof result.durationMs === 'number');

  const vectorver = scenarios[2];
  const conflict = await runMongo(vectorver, embeddings.questions[vectorver.id], dbName);
  assert.equal(conflict.state, 'conflict');
  assert.equal(conflict.selected, null);
});
