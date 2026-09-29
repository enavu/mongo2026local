import test from 'node:test';
import assert from 'node:assert/strict';
import { getFeature } from '../src/data/compatibility.js';
import { checkDrift } from '../src/lib/drift.js';

const feature = getFeature('vectorSearch');

test('supported when server and driver meet the ANN minimums', () => {
  const result = checkDrift({ feature, serverVersion: '7.0.5', driver: 'node', driverVersion: '6.8.0' });
  assert.equal(result.verdict, 'supported');
  assert.equal(result.server.ok, true);
  assert.equal(result.driver.ok, true);
});

test('server drift below the same release line minimum', () => {
  const result = checkDrift({ feature, serverVersion: '6.0.9', driver: 'node', driverVersion: '6.8.0' });
  assert.equal(result.verdict, 'drift');
  assert.equal(result.server.ok, false);
  assert.equal(result.server.required, '6.0.11');
});

test('driver drift below the minimum', () => {
  const result = checkDrift({ feature, serverVersion: '7.0.5', driver: 'node', driverVersion: '6.4.0' });
  assert.equal(result.verdict, 'drift');
  assert.equal(result.driver.ok, false);
  assert.equal(result.driver.required, '6.6.0');
});

test('ENN requires higher server minimums than ANN', () => {
  const ann = checkDrift({ feature, serverVersion: '7.0.5', searchType: 'ann' });
  const enn = checkDrift({ feature, serverVersion: '7.0.5', searchType: 'enn' });
  assert.equal(ann.server.ok, true);
  assert.equal(enn.server.ok, false);
  assert.equal(enn.server.required, '7.0.10');
});

test('bare-major driver minimum accepts that major or later', () => {
  assert.equal(checkDrift({ feature, serverVersion: '7.0.5', driver: 'go', driverVersion: '2.1.0' }).driver.ok, true);
  assert.equal(checkDrift({ feature, serverVersion: '7.0.5', driver: 'go', driverVersion: '1.17.0' }).driver.ok, false);
});

test('newer-than-documented server is flagged as assumed, not failed', () => {
  const result = checkDrift({ feature, serverVersion: '8.0.5' });
  assert.equal(result.server.ok, true);
  assert.match(result.server.basis, /assumed supported/);
});

test('unknown driver is reported distinctly', () => {
  const result = checkDrift({ feature, serverVersion: '7.0.5', driver: 'cobol', driverVersion: '1.0' });
  assert.equal(result.verdict, 'unknown-driver');
  assert.equal(result.driver.known, false);
});

test('an upcoming release (9.0) is provisional, not invented', () => {
  const result = checkDrift({ feature, serverVersion: '9.0.0', driver: 'node', driverVersion: '6.8.0' });
  assert.equal(result.verdict, 'provisional');
  assert.equal(result.server.provisional, true);
  assert.equal(result.server.required, null);
  assert.match(result.server.basis, /upcoming release/);
});
