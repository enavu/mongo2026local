import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scenarios, getScenario } from '../src/data/demo.js';
import { compatibility, getFeature } from '../src/data/compatibility.js';
import { serverVersions } from '../src/data/versions.js';
import { checkDrift } from '../src/lib/drift.js';
import { askMongo, askRehearsal, changelogGalaxy, close, connect, getVectors, queryShape, runMongo, runRehearsal, searchChangelog, upgradeChanges } from './store.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT ?? 8137);
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'memory_demo';

const embeddings = await readFile(join(root, 'src/data/embeddings.json'), 'utf8')
  .then(JSON.parse).catch(() => null);

let mongoReady = false;
if (uri) {
  try {
    const status = await connect(uri, dbName);
    mongoReady = status.indexReady;
  } catch (error) {
    console.warn('MongoDB unavailable, rehearsal only:', error.message);
  }
}

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ mongoReady, hasEmbeddings: Boolean(embeddings), queryShape });
});

app.get('/api/scenarios', (_req, res) => res.json({ scenarios }));

app.get('/api/compatibility', (_req, res) => res.json({
  features: compatibility.map((entry) => ({
    feature: entry.feature, label: entry.label,
    drivers: Object.keys(entry.drivers), searchTypes: Object.keys(entry.server),
  })),
  serverVersions,
}));

app.post('/api/changelog/search', async (req, res) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 200);
  if (!text) return res.status(400).json({ error: 'empty-question' });
  if (!mongoReady) return res.status(409).json({ error: 'mongo-unavailable' });
  try {
    return res.json(await searchChangelog(text, dbName));
  } catch (error) {
    return res.status(502).json({ error: 'search-failed', detail: error.message });
  }
});

app.get('/changelog', (_req, res) => res.sendFile(join(root, 'server/changelog.html')));

app.get('/deck', (_req, res) => res.sendFile(join(root, 'server/deck.html')));

app.get('/galaxy', (_req, res) => res.sendFile(join(root, 'server/galaxy.html')));

app.get('/api/changelog/galaxy', async (_req, res) => {
  if (!mongoReady) return res.status(409).json({ error: 'mongo-unavailable' });
  try {
    return res.json(await changelogGalaxy());
  } catch (error) {
    return res.status(500).json({ error: 'galaxy-failed', detail: error.message });
  }
});

app.get('/api/upgrade', async (req, res) => {
  const to = String(req.query.to ?? '').trim();
  if (!to) return res.status(400).json({ error: 'missing-to' });
  if (!mongoReady) return res.status(409).json({ error: 'mongo-unavailable' });
  try {
    return res.json(await upgradeChanges(to, dbName));
  } catch (error) {
    return res.status(502).json({ error: 'upgrade-failed', detail: error.message });
  }
});

app.post('/api/drift', (req, res) => {
  const feature = getFeature(req.body?.feature);
  if (!feature) return res.status(400).json({ error: 'unknown-feature' });
  const { serverVersion, driver, driverVersion, searchType } = req.body ?? {};
  if (!serverVersion) return res.status(400).json({ error: 'missing-server-version' });
  return res.json(checkDrift({ feature, serverVersion, driver: driver || null, driverVersion, searchType }));
});

app.get('/api/vectors', async (_req, res) => {
  try {
    return res.json(await getVectors());
  } catch (error) {
    return res.status(500).json({ error: 'vectors-failed', detail: error.message });
  }
});

app.post('/api/query', async (req, res) => {
  const scenario = getScenario(req.body?.scenarioId);
  if (!scenario) return res.status(400).json({ error: 'unknown-scenario' });
  const wantsMongo = req.body?.mode === 'mongodb';
  if (wantsMongo) {
    if (!mongoReady) return res.status(409).json({ error: 'mongo-unavailable' });
    const vector = embeddings?.questions?.[scenario.id];
    if (!vector) return res.status(409).json({ error: 'missing-embedding' });
    try {
      return res.json(await runMongo(scenario, vector, dbName));
    } catch (error) {
      return res.status(502).json({ error: 'mongo-failed', detail: error.message });
    }
  }
  return res.json(runRehearsal(scenario, embeddings?.questions?.[scenario.id]));
});

app.post('/api/ask', async (req, res) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 200);
  if (!text) return res.status(400).json({ error: 'empty-question' });
  const wantsMongo = req.body?.mode === 'mongodb';
  try {
    if (wantsMongo) {
      if (!mongoReady) return res.status(409).json({ error: 'mongo-unavailable' });
      return res.json(await askMongo(text, dbName));
    }
    return res.json(await askRehearsal(text));
  } catch (error) {
    return res.status(502).json({ error: 'ask-failed', detail: error.message });
  }
});

const dist = join(root, 'dist');
app.use(express.static(dist));
app.use((req, res) => {
  if (req.method !== 'GET') return res.status(404).json({ error: 'not-found' });
  return res.sendFile(join(dist, 'index.html'), (error) => {
    if (error) res.status(200).send('Run npm run build to serve the app, or use npm run dev.');
  });
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`API on http://127.0.0.1:${port} (mongo: ${mongoReady ? 'ready' : 'rehearsal only'})`);
});
await getVectors().catch(() => {});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await close(); server.close(); process.exit(0); });
}
