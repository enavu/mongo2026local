import { MongoClient } from 'mongodb';
import { readFile } from 'node:fs/promises';
import { memories } from '../src/data/demo.js';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'memory_demo';
if (!uri) { console.error('Set MONGODB_URI in .env (your Atlas SRV string).'); process.exit(1); }

async function main() {
  const embeddings = JSON.parse(await readFile('src/data/embeddings.json', 'utf8'));
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const collection = client.db(dbName).collection('memories');
  await collection.deleteMany({});
  await collection.insertMany(memories.map((memory) => ({
    ...memory,
    effective_at: new Date(memory.effective_at),
    recorded_at: new Date(memory.recorded_at),
    retrieved_at: new Date(memory.retrieved_at),
    embedding: embeddings.documents[memory._id],
  })));
  await collection.createIndex({ supersedes: 1 });
  await client.db(dbName).command({
    createSearchIndexes: 'memories',
    indexes: [{
      name: 'mem_vec', type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: embeddings.dims, similarity: 'cosine' },
          { type: 'filter', path: 'subject' },
          { type: 'filter', path: 'scope' },
        ],
      },
    }],
  }).catch((error) => { console.warn('Vector index note:', error.message); });
  console.log(`Seeded ${memories.length} memories into ${dbName}. Allow the vector index a moment to build.`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
