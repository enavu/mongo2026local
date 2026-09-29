import { MongoClient } from 'mongodb';
import { readFile } from 'node:fs/promises';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'memory_demo';
if (!uri) { console.error('Set MONGODB_URI in .env (your Atlas SRV string).'); process.exit(1); }

async function main() {
  const data = JSON.parse(await readFile('src/data/changelog.json', 'utf8'));
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const collection = client.db(dbName).collection('changelog');
  await collection.deleteMany({});
  await collection.insertMany(data.docs.map((doc) => ({
    ...doc,
    effective_at: doc.effective_at ? new Date(doc.effective_at) : null,
    retrieved_at: new Date(doc.retrieved_at),
  })));
  await collection.createIndex({ version: 1 });
  await collection.createIndex({ subject: 1 });
  await client.db(dbName).command({
    createSearchIndexes: 'changelog',
    indexes: [{
      name: 'chlog_vec', type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: data.dims, similarity: 'cosine' },
          { type: 'filter', path: 'subject' },
          { type: 'filter', path: 'version' },
        ],
      },
    }],
  }).catch((error) => { console.warn('Vector index note:', error.message); });
  console.log(`Seeded ${data.docs.length} changelog chunks into ${dbName}.changelog. Allow the chlog_vec index a moment to build.`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
