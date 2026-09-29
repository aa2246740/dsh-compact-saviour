import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import semver from 'semver';

const RANGE = '>=0.2.0-rc.1 <0.2.1';
const ACCEPT = ['0.2.0-rc.1', '0.2.0', '0.2.0-rc.2'];
const REJECT = ['0.2.0-alpha', '0.2.0-alpha.1', '0.2.0-alpha.2', '0.1.7-rc.2', '0.1.7-rc.1', '0.2.1'];

test('Harness peers use >=0.2.0-rc.1 <0.2.1', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '0.2.6');
  assert.equal(semver.satisfies('0.2.0-rc.1', RANGE), true);
  const peers = Object.entries(pkg.peerDependencies).filter(([name]) => name.startsWith('@deepseek-ai/dsh'));
  assert.ok(peers.length >= 17);
  for (const [name, range] of peers) assert.equal(range, RANGE, name);
  assert.equal(pkg.devDependencies['@deepseek-ai/dsh-agent-loop'], '0.2.0-rc.1');
  assert.equal(pkg.devDependencies['@deepseek-ai/dsh-agent-loop-testkit'], '0.2.0-rc.1');
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '^4.0.4');
  assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'], '^3.18.4');
  for (const version of ACCEPT) assert.equal(semver.satisfies(version, RANGE), true, version);
  for (const version of REJECT) assert.equal(semver.satisfies(version, RANGE), false, version);
});
