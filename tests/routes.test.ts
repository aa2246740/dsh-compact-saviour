import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CompactionRouteRegistry } from '../src/routes.js';
import { compress } from '../src/compress.js';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

const agent = (id = 'a') => ({ id, session: { id } }) as never;
const value = (revision = '1') => ({ revision, context: { provider: 'p', model: 'lead' },
  target: { provider: 'p', model: 'summary' }, maxOutputTokens: 2048 });

test('session leases isolate routes and expire on revision change or owner unload', () => {
  const registry = new CompactionRouteRegistry(); let revision = '1';
  const remove = registry.register('fixture', a => a.session.id === 'a' ? value(revision) : undefined);
  const first = registry.resolve(agent())!;
  assert.equal(registry.resolve(agent('ordinary')), undefined);
  first.assertCurrent(); revision = '2';
  assert.throws(() => first.assertCurrent(), /route changed/);
  const second = registry.resolve(agent())!; remove();
  assert.throws(() => second.assertCurrent(), /route changed/);
  assert.equal(second.signal.aborted, true);
});
test('ambiguous owners fail instead of choosing whichever plugin registered first', () => {
  const registry = new CompactionRouteRegistry();
  registry.register('one', () => value());
  const lease = registry.resolve(agent())!;
  registry.register('two', () => value());
  assert.throws(() => registry.resolve(agent()), /Multiple plugins/);
  assert.throws(() => lease.assertCurrent(), /Multiple plugins/);
});
test('a planned request retains its bounded cap and cannot be rerouted', () => {
  const registry = new CompactionRouteRegistry(); registry.register('fixture', () => value());
  const lease = registry.resolve(agent())!;
  const request = { provider: 'p', model: 'summary', sessionId: 'a', purpose: 'compaction', maxTokens: 1024, messages: [] };
  const planned = lease.prepare(request as never);
  assert.equal(planned.maxTokens, 1024); assert.equal(Object.isFrozen(planned), true);
  assert.throws(() => { planned.model = 'other'; });
  assert.throws(() => lease.prepare({ ...request, maxTokens: 4096 } as never), /planned physical route/);
  assert.throws(() => lease.prepare({ ...request, model: 'other' } as never), /planned physical route/);
});
test('physical planning uses the lease model and cap before dispatch, then rejects stale metadata', async () => {
  const registry = new CompactionRouteRegistry(); let revision = '1';
  registry.register('fixture', () => value(revision));
  const input = { messages: [createUserMessage({ content: [{ type: 'text', text: 'Preserve synthetic task facts. '.repeat(500) }] })] };
  const requests: any[] = [], metadata: string[] = [];
  const ctx = { llm: {
    async resolveModelInfo(provider: string, model: string) {
      metadata.push(model); return { provider, id: model, name: model, context: { contextWindow: 32000 }, defaultMaxTokens: 8192 };
    },
    async *stream(request: any) {
      requests.push(request); assert.equal(Object.isFrozen(request), true);
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Preserve task facts. Next: verify.' } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    },
  } };
  const lease = registry.resolve(agent())!;
  await compress(ctx as never, input, agent(), { target: lease.target, routeLease: lease,
    signal: new AbortController().signal, progress() {} });
  assert.deepEqual(metadata, ['summary']); assert.equal(requests[0].maxTokens, 2048);
  assert.equal(requests[0].model, 'summary');
  ctx.llm.resolveModelInfo = async (provider, model) => {
    revision = '2'; return { provider, id: model, name: model, context: { contextWindow: 32000 }, defaultMaxTokens: 8192 };
  };
  await assert.rejects(compress(ctx as never, input, agent(), { target: lease.target, routeLease: lease,
    signal: new AbortController().signal, progress() {} }), /route changed/);
  assert.equal(requests.length, 1);
});
