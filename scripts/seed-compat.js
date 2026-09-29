import { MongoClient } from 'mongodb';
import { env, pipeline } from '@huggingface/transformers';
import { compatibility } from '../src/data/compatibility.js';
import { serverVersions } from '../src/data/versions.js';

env.allowRemoteModels = false;
env.localModelPath = 'models';
const MODEL = 'Xenova/all-MiniLM-L6-v2';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'memory_demo';
if (!uri) { console.error('Set MONGODB_URI in .env (your Atlas SRV string).'); process.exit(1); }

async function main() {
  const embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  const vectorOf = async (text) => Array.from((await embed(text, { pooling: 'mean', normalize: true })).data);

  const docs = [];
  for (const entry of compatibility) {
    docs.push({ ...entry, _id: entry.feature, embedding: await vectorOf(`${entry.label}. ${entry.text}`) });
  }
  const dims = docs[0]?.embedding.length ?? 0;

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(dbName);
  await db.collection('compatibility').deleteMany({});
  await db.collection('compatibility').insertMany(docs);
  await db.collection('server_versions').deleteMany({});
  await db.collection('server_versions').insertMany(serverVersions.map((v) => ({ _id: v.line, ...v })));
  await db.command({
    createSearchIndexes: 'compatibility',
    indexes: [{
      name: 'compat_vec', type: 'vectorSearch',
      definition: { fields: [{ type: 'vector', path: 'embedding', numDimensions: dims, similarity: 'cosine' }] },
    }],
  }).catch((error) => { console.warn('Vector index note:', error.message); });
  console.log(`Seeded ${docs.length} compatibility feature(s) and ${serverVersions.length} server versions into ${dbName}.`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
