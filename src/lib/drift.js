// Version-constraint drift check. Similarity finds the feature; this decides
// whether a given server and driver version can actually run it.
import { versionStatus } from '../data/versions.js';

function parseVersion(value) {
  return String(value).split('.').map((part) => {
    const number = Number.parseInt(part, 10);
    return Number.isNaN(number) ? null : number; // null marks a wildcard (e.g. "x")
  });
}

// Compare a version against a minimum, ignoring wildcard positions in the minimum.
function meetsMinimum(version, minimum) {
  const v = parseVersion(version);
  const m = parseVersion(minimum);
  for (let i = 0; i < m.length; i += 1) {
    if (m[i] === null) return true;
    const part = v[i] ?? 0;
    if (part > m[i]) return true;
    if (part < m[i]) return false;
  }
  return true;
}

function checkServer(serverVersion, lines) {
  const status = versionStatus(serverVersion);
  if (status === 'upcoming') {
    return { ok: null, required: null, provisional: true,
      basis: 'upcoming release: no verified minimums yet, add them from the release notes when published' };
  }
  const v = parseVersion(serverVersion);
  const majorMinor = `${v[0]}.${v[1] ?? 0}`;
  const exact = lines.find((entry) => entry.line === majorMinor);
  if (exact) {
    return { ok: meetsMinimum(serverVersion, exact.min), required: exact.min, basis: 'documented line' };
  }
  const majors = lines.map((entry) => parseVersion(entry.min)[0]);
  const maxMajor = Math.max(...majors);
  if (v[0] > maxMajor) {
    return { ok: true, required: null, basis: 'newer than documented minimum (assumed supported)' };
  }
  const lowest = lines.reduce((a, b) => (meetsMinimum(a.min, b.min) ? b : a));
  return { ok: false, required: lowest.min, basis: 'below documented minimum' };
}

function checkDriver(driver, driverVersion, mins) {
  const key = String(driver ?? '').toLowerCase();
  const min = mins[key];
  if (!min) return { known: false };
  return { known: true, ok: meetsMinimum(driverVersion, min), required: min };
}

export function checkDrift({ feature, serverVersion, driver, driverVersion, searchType = 'ann' }) {
  const lines = feature.server[searchType] ?? feature.server.ann;
  const server = checkServer(serverVersion, lines);
  const driverResult = driver ? checkDriver(driver, driverVersion, feature.drivers) : { known: false, skipped: true };

  const reasons = [];
  if (server.ok === false) reasons.push(`server ${serverVersion} is below the ${searchType.toUpperCase()} minimum ${server.required}`);
  if (driverResult.known && !driverResult.ok) reasons.push(`${driver} driver ${driverVersion} is below the minimum ${driverResult.required}`);

  let verdict = 'supported';
  if (server.provisional) verdict = 'provisional';
  if (reasons.length) verdict = 'drift';
  else if (!server.provisional && driver && !driverResult.known) verdict = 'unknown-driver';

  return {
    feature: feature.feature, searchType, verdict, reasons,
    server: { version: serverVersion, ...server },
    driver: driver ? { name: driver, version: driverVersion, ...driverResult } : null,
    source: feature.source,
  };
}
