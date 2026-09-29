import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Database, FileText, RotateCcw, Search, X } from 'lucide-react';

const STAGES = [
  { id: 'recall', label: 'Recall', icon: Search, blurb: 'Similarity finds what looks relevant.' },
  { id: 'trace', label: 'Trace', icon: ArrowRight, blurb: 'Follow the replacement relationships.' },
  { id: 'resolve', label: 'Resolve', icon: CheckCircle2, blurb: 'Apply the rule that governs now.' },
];

const TONE = {
  resolved: { label: 'Resolved', icon: CheckCircle2, className: 'tone-resolved' },
  conflict: { label: 'Review required', icon: AlertTriangle, className: 'tone-conflict' },
  invalid: { label: 'Review required', icon: AlertTriangle, className: 'tone-conflict' },
  empty: { label: 'No applicable source', icon: AlertTriangle, className: 'tone-conflict' },
};

async function postQuery(scenarioId, mode) {
  const response = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId, mode }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'query-failed');
  return response.json();
}

const SUBJECT_COLORS = ['#10a37f', '#f5a524', '#6ea8fe', '#f0698e', '#b088f9'];

function VectorMap({ points, result, stage }) {
  const subjects = [...new Set(points.map((point) => point.subject))];
  const colorOf = (subject) => SUBJECT_COLORS[subjects.indexOf(subject) % SUBJECT_COLORS.length];
  const query = result?.queryPoint;
  const all = [...points.map((p) => [p.x, p.y]), ...(query ? [query] : [])];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const spanX = (maxX - minX) || 1; const spanY = (maxY - minY) || 1;
  const W = 640; const H = 320; const M = 28;
  const px = (x) => M + ((x - minX) / spanX) * (W - 2 * M);
  const py = (y) => H - M - ((y - minY) / spanY) * (H - 2 * M);
  const superseded = new Set(result?.supersededIds ?? []);
  const selectedId = result?.selected?._id;
  const baselineId = result?.baseline?._id;
  const evidenceIds = new Set((result?.evidence ?? []).map((r) => r._id));
  const byId = Object.fromEntries(points.map((p) => [p.id, p]));
  const line = (aId) => {
    if (!query || !byId[aId]) return null;
    return `M ${px(query[0])} ${py(query[1])} L ${px(byId[aId].x)} ${py(byId[aId].y)}`;
  };
  return (
    <svg className="vectormap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Embedding space projection">
      {stage > 0 && baselineId && <path d={line(baselineId)} className="vlink stale" />}
      {stage > 0 && selectedId && <path d={line(selectedId)} className="vlink live" />}
      {points.map((point) => {
        const isStale = stage > 0 && superseded.has(point.id);
        const isSelected = point.id === selectedId;
        const dim = evidenceIds.size && !evidenceIds.has(point.id);
        return (
          <g key={point.id} opacity={dim ? 0.3 : 1}>
            <circle cx={px(point.x)} cy={py(point.y)} r={isSelected ? 8 : 6} className="vpoint"
              fill={colorOf(point.subject)} stroke={isSelected ? '#fff' : 'none'} strokeWidth={isSelected ? 2 : 0} />
            {isStale && <circle cx={px(point.x)} cy={py(point.y)} r={9} className="vstale" />}
          </g>
        );
      })}
      {query && (
        <g>
          <circle cx={px(query[0])} cy={py(query[1])} r={7} className="vquery" />
          <text x={px(query[0]) + 10} y={py(query[1]) + 4} className="vlabel">your question</text>
        </g>
      )}
    </svg>
  );
}

export function App() {
  const [scenarios, setScenarios] = useState([]);
  const [health, setHealth] = useState({ mongoReady: false });
  const [scenarioId, setScenarioId] = useState(null);
  const [mode, setMode] = useState('rehearsal');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [inspected, setInspected] = useState(null);
  const [vectors, setVectors] = useState([]);
  const [showVectors, setShowVectors] = useState(false);
  const [compat, setCompat] = useState(null);
  const [showDrift, setShowDrift] = useState(false);
  const [driftForm, setDriftForm] = useState({ feature: 'vectorSearch', driver: 'node', driverVersion: '6.8.0', serverVersion: '9.0.0', searchType: 'ann' });
  const [drift, setDrift] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeForm, setUpgradeForm] = useState({ from: '7.0', to: '8.0' });
  const [upgrade, setUpgrade] = useState(null);
  const [upgradeStatus, setUpgradeStatus] = useState('idle');
  const [showQuery, setShowQuery] = useState(false);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [chlogQuery, setChlogQuery] = useState('MongoDB 9.0 new features');
  const [chlog, setChlog] = useState(null);
  const [chlogStatus, setChlogStatus] = useState('idle');

  useEffect(() => {
    fetch('/api/scenarios').then((response) => response.json())
      .then((data) => { setScenarios(data.scenarios); setScenarioId(data.scenarios[0]?.id ?? null); })
      .catch(() => setStatus('error'));
    fetch('/api/health').then((response) => response.json()).then(setHealth).catch(() => {});
    fetch('/api/vectors').then((response) => response.json()).then((data) => setVectors(data.points ?? [])).catch(() => {});
    fetch('/api/compatibility').then((response) => response.json()).then(setCompat).catch(() => {});
  }, []);

  const scenario = useMemo(
    () => scenarios.find((item) => item.id === scenarioId) ?? null,
    [scenarios, scenarioId],
  );

  const load = useCallback(async (id, activeMode) => {
    setStatus('loading');
    setResult(null);
    setStage(0);
    try {
      setResult(await postQuery(id, activeMode));
      setStatus('ready');
    } catch (error) {
      setStatus(error.message === 'mongo-unavailable' ? 'unavailable' : 'error');
    }
  }, []);

  useEffect(() => { if (scenarioId && !asked) load(scenarioId, mode); }, [scenarioId, mode, asked, load]);

  const searchChangelog = useCallback(async (text) => {
    if (!text.trim()) return;
    setChlogStatus('loading');
    try {
      const response = await fetch('/api/changelog/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error('search-failed');
      setChlog(await response.json());
      setChlogStatus('ready');
    } catch {
      setChlog(null);
      setChlogStatus('error');
    }
  }, []);

  const ask = useCallback(async (text, activeMode) => {
    if (!text.trim()) return;
    setStatus('loading');
    setAsked(true);
    setResult(null);
    setStage(0);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode: activeMode }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'ask-failed');
      const data = await response.json();
      setResult(data);
      setStatus('ready');
      // Curated corrections can't answer everything; fall back to the changelog corpus.
      if (!data.evidence?.length || data.state === 'empty') {
        setShowChangelog(true);
        setChlogQuery(text);
        searchChangelog(text);
      }
    } catch (error) {
      setStatus(error.message === 'mongo-unavailable' ? 'unavailable' : 'error');
    }
  }, [searchChangelog]);

  const pickScenario = (id) => { setAsked(false); setScenarioId(id); };
  const runDrift = useCallback(async (form) => {
    setDrift(null);
    const response = await fetch('/api/drift', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (response.ok) setDrift(await response.json());
  }, []);

  const loadUpgrade = useCallback(async (to) => {
    setUpgradeStatus('loading');
    try {
      const response = await fetch(`/api/upgrade?to=${encodeURIComponent(to)}`);
      if (!response.ok) throw new Error('upgrade-failed');
      setUpgrade(await response.json());
      setUpgradeStatus('ready');
    } catch {
      setUpgrade(null);
      setUpgradeStatus('error');
    }
  }, []);

  const reset = () => {
    setStage(0); setInspected(null); setShowQuery(false);
    if (asked) ask(question, mode); else if (scenarioId) load(scenarioId, mode);
  };
  const evidence = result?.evidence ?? [];
  const baselineId = result?.baseline?._id ?? scenario?.baselineId;
  const visibleEvidence = stage === 0
    ? evidence.filter((record) => record._id === baselineId)
    : evidence;
  const tone = TONE[result?.state] ?? TONE.empty;
  // Question answered from the changelog corpus, not the curated resolve flow.
  const changelogAnswer = asked && status === 'ready' && evidence.length === 0;
  const driftFeature = compat?.features.find((f) => f.feature === driftForm.feature) ?? null;
  const driftHasEnn = (driftFeature?.searchTypes ?? []).includes('enn');
  const driftHasDrivers = (driftFeature?.drivers ?? []).length > 0;

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Agent memory on MongoDB</p>
          <h1>Memory that keeps up</h1>
          <p className="subtitle">When the rule changes, the answer should change with it.</p>
        </div>
        <div className="mode" role="group" aria-label="Execution mode">
          <button className={mode === 'rehearsal' ? 'active' : ''} onClick={() => setMode('rehearsal')}>
            Rehearsal fixtures
          </button>
          <button
            className={mode === 'mongodb' ? 'active' : ''}
            onClick={() => setMode('mongodb')}
            disabled={!health.mongoReady}
            title={health.mongoReady ? '' : 'Start local MongoDB and seed to enable'}
          >
            <Database size={15} aria-hidden="true" /> Live MongoDB
          </button>
        </div>
      </header>

      <nav className="scenarios" aria-label="Scenario">
        {scenarios.map((item) => (
          <button key={item.id} className={item.id === scenarioId && !asked ? 'chip active' : 'chip'}
            onClick={() => pickScenario(item.id)} aria-pressed={item.id === scenarioId && !asked}>
            {item.shortLabel}
          </button>
        ))}
      </nav>

      <form className="ask" onSubmit={(event) => { event.preventDefault(); ask(question, mode); }}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about a MongoDB command, method, or version…"
          aria-label="Ask your own question"
          maxLength={200}
        />
        <button type="submit" className="primary" disabled={!question.trim()}>Ask</button>
      </form>

      {asked ? (
        <section className="question-card">
          <div className="question-lead">
            <p className="context">{changelogAnswer ? 'Your question' : `Your question · ${result?.subject ?? 'resolving…'}`}</p>
            <h2>{result?.question ?? question}</h2>
          </div>
          <dl className="facts">
            <div><dt>Source scope</dt><dd>{result?.selected?.scope ?? result?.baseline?.scope ?? '—'}</dd></div>
            <div><dt>State</dt><dd>{changelogAnswer ? 'changelog' : (result?.state ?? 'loading')}</dd></div>
            <div><dt>Mode</dt><dd>{mode === 'mongodb' ? 'Live MongoDB' : 'Rehearsal fixtures'}</dd></div>
          </dl>
        </section>
      ) : scenario && (
        <section className="question-card">
          <div className="question-lead">
            <p className="context">{scenario.context}</p>
            <h2>{scenario.question}</h2>
          </div>
          <dl className="facts">
            <div><dt>{scenario.dateLabel}</dt><dd>{scenario.effectiveAt}</dd></div>
            <div><dt>{scenario.metricLabel}</dt><dd>{scenario.metric}</dd></div>
            <div><dt>Mode</dt><dd>{mode === 'mongodb' ? 'Live MongoDB' : 'Rehearsal fixtures'}</dd></div>
          </dl>
        </section>
      )}

      {!changelogAnswer && (
        <ol className="stages">
          {STAGES.map((item, index) => {
            const Icon = item.icon;
            const state = index === stage ? 'current' : index < stage ? 'done' : 'upcoming';
            return (
              <li key={item.id} className={`stage ${state}`}>
                <span className="stage-index"><Icon size={16} aria-hidden="true" /></span>
                <span className="stage-text"><strong>{item.label}</strong><span>{item.blurb}</span></span>
              </li>
            );
          })}
        </ol>
      )}

      <section className="panel" aria-live="polite">
        {status === 'loading' && <p className="hint">Running query…</p>}
        {status === 'unavailable' && (
          <p className="hint warn">Live MongoDB is not ready. Start and seed it, or use rehearsal fixtures.</p>
        )}
        {status === 'error' && <p className="hint warn">The query could not run. Check the API process.</p>}
        {status === 'ready' && evidence.length === 0 && (
          asked
            ? <p className="hint">Not in memory — answering from the live MongoDB changelog below.</p>
            : <p className="hint warn">{result?.reason ?? 'No applicable source for this scenario and cutoff.'}</p>
        )}
        {status === 'ready' && evidence.length > 0 && (
          <div className="evidence">
            {visibleEvidence.map((record) => {
              const superseded = stage > 0 && result.supersededIds.includes(record._id);
              const related = !record.answer;
              return (
                <button key={record._id} className={`record ${superseded ? 'superseded' : ''} ${related ? 'related' : ''}`}
                  onClick={() => setInspected(record)}>
                  <span className="record-head">
                    <FileText size={15} aria-hidden="true" />
                    <span className="record-title">{record.title}</span>
                    {typeof record.score === 'number' && (
                      <span className="score">{record.score.toFixed(3)}</span>
                    )}
                  </span>
                  <span className="record-value">{record.value ?? 'Context only \u2014 does not change the answer'}</span>
                  <span className="record-meta">
                    {record.source.reference} · effective {record.effective_at}
                    {superseded && ' · superseded'}
                    {related && ' · related'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {showVectors && vectors.length > 0 && (
        <section className="vectorpanel">
          <div className="vectorpanel-head">
            <span>Embedding space (384 dims → 2D). Nearby points look similar to vector search.</span>
            <span className="vlegend">
              <i className="dot-stale" /> superseded
              <i className="dot-query" /> your question
            </span>
          </div>
          <VectorMap points={vectors} result={result} stage={stage} />
          <p className="vectorpanel-note">
            The deprecated fact and its correction sit almost on top of each other. That adjacency is why
            similarity alone cannot tell them apart — the edge can.
          </p>
        </section>
      )}

      {showDrift && compat && (
        <section className="driftpanel">
          <div className="driftpanel-head">Version drift check — does your stack run this feature?</div>
          <div className="driftform">
            <label>Feature
              <select value={driftForm.feature} onChange={(e) => setDriftForm({ ...driftForm, feature: e.target.value })}>
                {compat.features.map((f) => <option key={f.feature} value={f.feature}>{f.label}</option>)}
              </select>
            </label>
            {driftHasEnn && (
              <label>Search
                <select value={driftForm.searchType} onChange={(e) => setDriftForm({ ...driftForm, searchType: e.target.value })}>
                  <option value="ann">ANN</option><option value="enn">ENN</option>
                </select>
              </label>
            )}
            <label>Server version
              <input value={driftForm.serverVersion} onChange={(e) => setDriftForm({ ...driftForm, serverVersion: e.target.value })} placeholder="9.0.0" />
            </label>
            {driftHasDrivers && (
              <>
                <label>Driver
                  <select value={driftForm.driver} onChange={(e) => setDriftForm({ ...driftForm, driver: e.target.value })}>
                    {(driftFeature?.drivers ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <label>Driver version
                  <input value={driftForm.driverVersion} onChange={(e) => setDriftForm({ ...driftForm, driverVersion: e.target.value })} placeholder="6.8.0" />
                </label>
              </>
            )}
            <button className="primary" onClick={() => runDrift(driftForm)}>Check drift</button>
          </div>
          {drift && (
            <div className={`driftresult ${drift.verdict}`}>
              <div className="driftverdict">{drift.verdict.replace('-', ' ')}</div>
              <p>Server {drift.server.version}: {drift.server.provisional ? 'provisional' : drift.server.ok ? 'meets minimum' : `needs ${drift.server.required}`} — {drift.server.basis}</p>
              {drift.driver && <p>{drift.driver.name} driver {drift.driver.version}: {!drift.driver.known ? 'unknown driver' : drift.driver.ok ? 'meets minimum' : `needs ${drift.driver.required}`}</p>}
              {drift.reasons.length > 0 && <p className="driftreasons">{drift.reasons.join('; ')}</p>}
              <p className="dialog-link">{drift.source.url}</p>
            </div>
          )}
        </section>
      )}

      {showUpgrade && compat && (
        <section className="changelogpanel">
          <div className="driftpanel-head">Upgrade impact — what changes when you move between versions?</div>
          <div className="driftform">
            <label>From
              <select value={upgradeForm.from} onChange={(e) => setUpgradeForm({ ...upgradeForm, from: e.target.value })}>
                {compat.serverVersions.map((v) => <option key={v.line} value={v.line}>{v.line}</option>)}
              </select>
            </label>
            <label>To
              <select value={upgradeForm.to} onChange={(e) => { const to = e.target.value; setUpgradeForm({ ...upgradeForm, to }); loadUpgrade(to); }}>
                {compat.serverVersions.filter((v) => v.line !== '6.0').map((v) => (
                  <option key={v.line} value={v.line}>{v.line}{v.status === 'upcoming' ? ' (pre-GA)' : ''}</option>
                ))}
              </select>
            </label>
            <button className="primary" onClick={() => loadUpgrade(upgradeForm.to)}>Show changes</button>
          </div>
          {upgradeStatus === 'loading' && <p className="hint">Querying Atlas…</p>}
          {upgradeStatus === 'error' && <p className="hint warn">The upgrade lookup could not run.</p>}
          {upgradeStatus === 'ready' && upgrade && (
            <div className="evidence">
              {compat.serverVersions.find((v) => v.line === upgrade.to)?.status === 'upcoming' && (
                <p className="hint warn">{upgrade.to} is pre-GA — these changes are provisional and may still change before release.</p>
              )}
              <p className="record-meta">Upgrading to {upgrade.to} — {upgrade.changes.length} breaking, {upgrade.gains.length} gains</p>
              <div className="upgradecols">
                <div className="upgradecol">
                  <p className="upgradecol-head cost"><AlertTriangle size={14} aria-hidden="true" /> What breaks</p>
                  {upgrade.changes.map((change, index) => (
                    <a key={index} className="record" href={change.url ?? '#'} target="_blank" rel="noreferrer">
                      <span className="record-head"><span className="record-title">{change.title}</span></span>
                      {change.text && <span className="record-value">{change.text.slice(0, 160)}{change.text.length > 160 ? '…' : ''}</span>}
                    </a>
                  ))}
                </div>
                <div className="upgradecol">
                  <p className="upgradecol-head gain"><CheckCircle2 size={14} aria-hidden="true" /> What you gain</p>
                  {upgrade.gains.map((gain, index) => (
                    <a key={index} className="record" href={gain.url ?? '#'} target="_blank" rel="noreferrer">
                      <span className="record-head"><span className="record-title">{gain.title}</span></span>
                      {gain.text && <span className="record-value">{gain.text.slice(0, 160)}{gain.text.length > 160 ? '…' : ''}</span>}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {showChangelog && (
        <section className="changelogpanel">
          <div className="driftpanel-head">
            Changelog corpus — one $vectorSearch over MongoDB 9.0/8.0/7.0 release notes in Atlas.
          </div>
          <form className="changelogform" onSubmit={(event) => { event.preventDefault(); searchChangelog(chlogQuery); }}>
            <input
              value={chlogQuery}
              onChange={(event) => setChlogQuery(event.target.value)}
              placeholder="Search the release notes by meaning…"
              aria-label="Search the changelog corpus"
              maxLength={200}
            />
            <button type="submit" className="primary" disabled={!chlogQuery.trim() || !health.mongoReady}>Search</button>
          </form>
          {!health.mongoReady && <p className="hint warn">Live MongoDB is not ready — the changelog corpus is served from Atlas.</p>}
          {chlogStatus === 'loading' && <p className="hint">Searching Atlas…</p>}
          {chlogStatus === 'error' && <p className="hint warn">The changelog search could not run.</p>}
          {chlogStatus === 'ready' && chlog && (
            <div className="evidence">
              {chlog.results[0] && chlog.results[0].score < 0.7 ? (
                <p className="hint warn">No strong changelog match — this reads like a usage question. The release notes cover what changed, not how to use a feature.</p>
              ) : (
                <p className="record-meta">{chlog.results.length} matches · {chlog.durationMs} ms round-trip to Atlas</p>
              )}
              {chlog.results.map((hit, index) => (
                <a key={index} className="record" href={hit.url ?? '#'} target="_blank" rel="noreferrer">
                  <span className="record-head">
                    <FileText size={15} aria-hidden="true" />
                    <span className="record-title">{hit.title}</span>
                    <span className="score">{hit.score.toFixed(3)}</span>
                  </span>
                  {hit.text && <span className="record-value">{hit.text.slice(0, 220)}{hit.text.length > 220 ? '…' : ''}</span>}
                  <span className="record-meta">
                    {hit.version ? `v${hit.version}` : 'release note'}
                    {hit.date ? ` · ${hit.date}` : ''}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {stage === STAGES.length - 1 && status === 'ready' && (
        <section className={`decision ${tone.className}`}>
          <div className="decision-head">
            <tone.icon size={18} aria-hidden="true" />
            <span>{tone.label}</span>
            {result.durationMs != null && <span className="duration">{result.durationMs} ms</span>}
          </div>
          <p className="decision-before">Similarity alone answered: {result.baseline?.answer ?? '—'}</p>
          <p className="decision-after">
            {result.selected ? result.selected.answer : result.reason}
          </p>
          {result.selected && <p className="decision-source">Source: {result.selected.source.title} ({result.selected.source.reference})</p>}
          <p className="decision-takeaway">{scenario?.takeaway}</p>
        </section>
      )}

      <footer className="controls">
        <button className="ghost" onClick={reset}><RotateCcw size={15} aria-hidden="true" /> Reset</button>
        <button className="ghost" onClick={() => setShowQuery(true)} disabled={!health.queryShape}>
          View query
        </button>
        <button className={showVectors ? 'ghost active' : 'ghost'} onClick={() => setShowVectors((value) => !value)}
          disabled={!vectors.length} aria-pressed={showVectors}>
          {showVectors ? 'Hide vectors' : 'Show vectors'}
        </button>
        <button className={showDrift ? 'ghost active' : 'ghost'} onClick={() => setShowDrift((value) => !value)}
          disabled={!compat} aria-pressed={showDrift}>
          {showDrift ? 'Hide drift' : 'Drift check'}
        </button>
        <button className={showUpgrade ? 'ghost active' : 'ghost'}
          onClick={() => { setShowUpgrade((value) => !value); if (!upgrade) loadUpgrade(upgradeForm.to); }}
          disabled={!compat} aria-pressed={showUpgrade}>
          {showUpgrade ? 'Hide upgrade' : 'Upgrade impact'}
        </button>
        <button className={showChangelog ? 'ghost active' : 'ghost'}
          onClick={() => { setShowChangelog((value) => !value); if (!chlog) searchChangelog(chlogQuery); }}
          aria-pressed={showChangelog}>
          {showChangelog ? 'Hide changelog' : 'Changelog corpus'}
        </button>
        <a className="ghost" href="/galaxy" target="_blank" rel="noreferrer">Vector galaxy ↗</a>
        <div className="spacer" />
        <button className="ghost" onClick={() => setStage((value) => Math.max(0, value - 1))} disabled={stage === 0}>
          Back
        </button>
        <button className="primary" onClick={() => setStage((value) => Math.min(STAGES.length - 1, value + 1))}
          disabled={stage === STAGES.length - 1 || status !== 'ready'}>
          {STAGES[stage + 1]?.label ? `Next: ${STAGES[stage + 1].label}` : 'Done'}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </footer>

      {inspected && (
        <Dialog title={inspected.title} onClose={() => setInspected(null)}>
          <p className="dialog-text">{inspected.text}</p>
          <dl className="dialog-facts">
            <div><dt>Source</dt><dd>{inspected.source.title}</dd></div>
            <div><dt>Section</dt><dd>{inspected.source.section}</dd></div>
            <div><dt>Applies to</dt><dd>{inspected.source.product_version}</dd></div>
            <div><dt>Retrieved</dt><dd>{inspected.retrieved_at ?? '\u2014'}</dd></div>
            <div><dt>Effective</dt><dd>{inspected.effective_at}</dd></div>
            <div><dt>Replaces</dt><dd>{inspected.supersedes.join(', ') || 'nothing'}</dd></div>
          </dl>
          {inspected.supersedes.map((id) => (
            <p key={id} className="dialog-evidence">Replaces {id}: “{inspected.supersedes_evidence?.[id] ?? 'documented replacement'}”</p>
          ))}
          <p className="dialog-link">{inspected.source.url}</p>
        </Dialog>
      )}

      {showQuery && (
        <Dialog title="One aggregation, three signals" onClose={() => setShowQuery(false)}>
          <p className="dialog-text">Documents, vectors, and relationships in a single collection.</p>
          <pre className="query">{health.queryShape}</pre>
        </Dialog>
      )}
    </div>
  );
}

function Dialog({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <h3>{title}</h3>
          <button className="icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
