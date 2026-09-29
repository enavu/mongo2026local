import { compatibility, getFeature } from '../src/data/compatibility.js';
import { checkDrift } from '../src/lib/drift.js';

const [featureArg, driver, driverVersion, serverVersion, typeArg] = process.argv.slice(2);
const searchType = typeArg === 'enn' ? 'enn' : 'ann';

function render(result) {
  const mark = { supported: 'OK', 'unknown-driver': '??', provisional: 'PROVISIONAL' }[result.verdict] ?? 'DRIFT';
  console.log(`[${mark}] ${result.feature} (${result.searchType.toUpperCase()})`);
  const server = result.server.provisional ? 'provisional' : result.server.ok ? 'ok' : `needs ${result.server.required}`;
  console.log(`  server ${result.server.version}: ${server} (${result.server.basis})`);
  if (result.driver) {
    const d = result.driver;
    console.log(`  ${d.name} driver ${d.version}: ${!d.known ? 'unknown driver' : d.ok ? 'ok' : `needs ${d.required}`}`);
  }
  if (result.reasons.length) console.log(`  drift: ${result.reasons.join('; ')}`);
  console.log(`  source: ${result.source.url}`);
}

if (featureArg) {
  const feature = getFeature(featureArg);
  if (!feature) { console.error(`Unknown feature: ${featureArg}`); process.exit(1); }
  render(checkDrift({ feature, serverVersion, driver, driverVersion, searchType }));
} else {
  const feature = compatibility[0];
  console.log('Examples (no args). Usage: npm run drift -- vectorSearch node 6.4.0 6.0.9 [enn]\n');
  render(checkDrift({ feature, serverVersion: '7.0.5', driver: 'node', driverVersion: '6.8.0' }));
  render(checkDrift({ feature, serverVersion: '6.0.9', driver: 'node', driverVersion: '6.8.0' }));
  render(checkDrift({ feature, serverVersion: '7.0.5', driver: 'node', driverVersion: '6.4.0' }));
  render(checkDrift({ feature, serverVersion: '7.0.5', searchType: 'enn' }));
}
