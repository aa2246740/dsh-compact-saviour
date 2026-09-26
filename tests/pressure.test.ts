import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressureEstimate } from '../src/pressure.js';
import type { TokenMeasurement } from '@deepseek-ai/dsh-token-meter';

test('oversized real surfaces and missing or valid anchors never get a lower pressure override', () => {
  const value = { baseline: { kind: 'usage', tokens: 8_000_000 }, surfaceTokens: 90_000 } as TokenMeasurement;
  assert.equal(pressureEstimate(value, 100_000), undefined);
  assert.equal(pressureEstimate({ ...value, surfaceTokens: 4000 }, 100_000), 4000);
  assert.equal(pressureEstimate({ ...value, baseline: { kind: 'estimated', tokens: 8_000_000 }, surfaceTokens: 4000 }, 100_000), undefined);
});
