import { MongoClient } from 'mongodb';
import { memories } from '../src/data/demo.js';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'memory_demo';

const line = (ok, label, detail) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` \u2014 ${detail}` : ''}`);

async function main() {
  if (!uri) { line(false, 'MONGODB_URI set', 'copy .env.example to .env and set your Atlas SRV string'); process.exit(1); }
  const isAtlas = /mongodb\+srv:\/\//.test(uri) || /mongodb\.net/.test(uri);
  line(true, 'Connection string', isAtlas ? 'Atlas cluster' : 'local / non-Atlas');

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  let ok = true;
  try {
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    line(true, 'Cluster reachable', dbName);

    const collection = client.db(dbName).collection('memories');
    const count = await collection.countDocuments();
    const seeded = count === memories.length;
    ok = ok && seeded;
    line(seeded, 'Documents seeded', `${count}/${memories.length} (run npm run seed if short)`);

    const withVectors = await collection.countDocuments({ embedding: { $exists: true, $type: 'array' } });
    const vectorsOk = withVectors === count && count > 0;
    ok = ok && vectorsOk;
    line(vectorsOk, 'Embeddings present', `${withVectors}/${count} docs carry an embedding`);

    const indexes = await collection.listSearchIndexes().toArray().catch(() => []);
    const vectorIndex = indexes.find((index) => index.name === 'mem_vec');
    const queryable = Boolean(vectorIndex?.queryable);
    ok = ok && queryable;
    line(queryable, 'Vector index mem_vec queryable',
      vectorIndex ? (queryable ? 'ready' : 'still building, wait a moment') : 'missing (run npm run seed)');

    const changelog = client.db(dbName).collection('changelog');
    const chlogCount = await changelog.countDocuments().catch(() => 0);
    if (chlogCount > 0) {
      const chlogIndexes = await changelog.listSearchIndexes().toArray().catch(() => []);
      const chlogReady = chlogIndexes.some((index) => index.name === 'chlog_vec' && index.queryable);
      line(chlogReady, 'Changelog corpus + chlog_vec', `${chlogCount} chunks, index ${chlogReady ? 'ready' : 'building'}`);
    } else {
      line(true, 'Changelog corpus', 'not loaded (optional: npm run ingest:changelog && npm run seed:changelog)');
    }
  } catch (error) {
    ok = false;
    line(false, 'Cluster reachable', error.message);
  } finally {
    await client.close();
  }

  console.log(ok ? '\nReady: point the app at Atlas (npm start) or explore in the Atlas UI.' : '\nNot ready: fix the FAIL rows above.');
  process.exit(ok ? 0 : 1);
}

main().catch((error) => { console.error(error); process.exit(1); });
