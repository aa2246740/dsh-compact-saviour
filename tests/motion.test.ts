import { test } from 'node:test';
import assert from 'node:assert/strict';
import motion from '../src/client/vendor/open-bot-motion.cjs';
import { orbitTime, settleFrame } from '../src/client/satellite.js';

test('satellite loop preserves position and pose across its wrap', () => {
  const before = motion.getBot7State(orbitTime(4.4 - 1e-7));
  const after = motion.getBot7State(orbitTime(4.4 + 1e-7));
  for (const key of Object.keys(before.bot)) {
    if (typeof before.bot[key] === 'number') assert.ok(Math.abs(Number(before.bot[key]) - Number(after.bot[key])) < 1e-4, key);
  }
  before.dots.forEach((dot, i) => {
    for (const key of ['x', 'y', 'r'] as const) assert.ok(Math.abs(dot[key] - after.dots[i]![key]) < 1e-4, `dot ${i} ${key}`);
  });
});

test('satellite completion settles from its current pose without jumping to a fixed phase', () => {
  for (const time of [2.45, 2.8, 3.7, 5.9, 6.3]) {
    const current = motion.getBot7State(time);
    const start = settleFrame(current, 0), end = settleFrame(current, 1);
    for (const key of Object.keys(current.bot)) if (typeof current.bot[key] === 'number') assert.equal(start.bot[key], current.bot[key]);
    assert.deepEqual(start.dots, current.dots);
    assert.deepEqual(end.bot, motion.getBot7State(0).bot);
    assert.ok(end.dots.every(dot => dot.r === 0));
  }
});
