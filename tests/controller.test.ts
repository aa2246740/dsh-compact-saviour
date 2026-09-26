import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import AgentLoop from '@deepseek-ai/dsh-agent-loop';
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit';
import TokenMeter from '@deepseek-ai/dsh-token-meter';
import Basic from '@deepseek-ai/dsh-compaction-basic';
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { Controller } from '../src/controller.js';
import { Config } from '../src/dsh-compact-saviour.js';
import { selectCompactableRange } from '../src/vendor/region.js';

class Adapter extends LlmAdapter {
  compactModels: string[] = [];
  failRescue = false;
  failWorking = true;
  gate?: Promise<void>;
  usageInputTokens?: number;
  async resolveModel(provider: string, model: string) { return { provider, id: model, name: model, context: { contextWindow: 100000 } }; }
  async *stream(request: any) {
    if (request.purpose === 'compaction') {
      this.compactModels.push(request.model);
      if (request.model === 'working' && this.failWorking) throw new Error('working model quota exhausted');
      if (request.model === 'fast' && this.failRescue) throw new Error('rescue model unavailable');
    }
    if (request.purpose !== 'compaction' && this.gate) await this.gate;
    yield { type: 'block-start' as const, index: 0, blockType: 'text' as const };
    yield { type: 'block-end' as const, index: 0, block: { type: 'text' as const, text: request.purpose === 'compaction' ? 'User needs popup-only manual compression. Preserve original UI. Next: verify.' : 'done' } };
    if (request.purpose !== 'compaction' && this.usageInputTokens) yield { type: 'usage' as const, usage: { inputTokens: this.usageInputTokens, outputTokens: 1 } };
    yield { type: 'finish' as const, reason: { kind: 'stop' as const } };
  }
}
async function fixture(usageInputTokens?: number, mode: 'direct' | 'rescue' | 'legacy' = 'rescue', enabled = true) {
  const ctx = new Context(); await mountAgentLoopTestDependencies(ctx);
  await ctx.plugin(AgentLoop, { agents: [] }); await ctx.plugin(TokenMeter); await ctx.plugin(Loader);
  ctx.loader.internal = { version: 'v2', async import(name: string) { if (name === '@deepseek-ai/dsh-compaction-basic') return Basic; throw new Error(name); } } as never;
  const adapter = new Adapter(); ctx.llm.registerAdapter(['mock'], adapter);
  adapter.usageInputTokens = usageInputTokens;
  const agent = await ctx.agentLoop.create(SessionId(`cs-controller-${Math.random()}`), { provider: 'mock', model: 'working' });
  await agent.ctx.plugin({ inject: ['loader'], async apply(child: Context) {
    await child.loader.create({ id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic', config: { auto: false } });
  } });
  await ctx.loader.await();
  let controller!: Controller;
  const owner = ctx.plugin({ name: 'test-saviour-owner', inject: ['agents', 'llm', 'tokenMeter', 'sessionProjections'], apply(child: Context) {
    controller = new Controller(child, { get: () => ({ enabled, ...(mode === 'legacy' ? {} : { mode }), provider: 'mock', model: 'fast', reasoningEffort: '' }) } as never);
  } });
  await owner;
  for (const text of ['history facts '.repeat(1200), 'last request '.repeat(400)]) {
    agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle();
  }
  return { ctx, agent, adapter, controller, owner };
}
test('fresh and missing-mode settings default to rescue; explicit direct remains opt-in', () => {
  assert.equal(Config({}).mode.get(), 'rescue');
  assert.equal(Config({ provider: 'mock', model: 'fast' }).mode.get(), 'rescue');
  assert.equal(Config({ mode: 'direct', provider: 'mock', model: 'fast' }).mode.get(), 'direct');
});
for (const mode of ['rescue', 'legacy'] as const) test(`real Loader engine (${mode}): first failure stays official; second failure invokes dedicated rescue once`, async () => {
  const { ctx, agent, adapter, controller } = await fixture(undefined, mode);
  try {
    assert.equal(controller.state(agent.session.id).available, true);
    let tested = false;
    agent.ctx.on('agent/pre-step', async ({ signal }, next) => {
      if (!tested) {
        tested = true;
        const range = selectCompactableRange(agent.session, ctx.tokenMeter.measure(agent.session), 0)!;
        await assert.rejects(agent.ctx.get('compaction')!.compactRegion(range.start, range.end, agent, signal));
        assert.deepEqual(adapter.compactModels, ['working']);
        assert.equal(controller.state(agent.session.id).job.failures, 1);
        const result = await agent.ctx.get('compaction')!.compactRegion(range.start, range.end, agent, signal);
        assert.ok(result.summarySeq);
      }
      return next();
    });
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Continue.' }], source: { kind: 'user' } })); await agent.whenIdle();
    assert.ok(tested); assert.deepEqual(adapter.compactModels, ['working', 'working', 'fast']);
    assert.equal(controller.state(agent.session.id).job.phase, 'done');
    assert.equal(controller.state(agent.session.id).job.failures, 0);
    assert.equal(agent.session.requestHeader()?.config.model, 'working', 'automatic rescue keeps the conversation model');
  } finally { await ctx.fiber.dispose(); }
});
test('manual request reserves idle maintenance and leaves conversation model unchanged', async () => {
  const { ctx, agent, adapter, controller } = await fixture();
  try {
    controller.request(agent.session.id, 'configured');
    for (let i = 0; i < 100 && ['queued', 'running'].includes(controller.state(agent.session.id).job.phase); i++) await new Promise(r => setTimeout(r, 5));
    assert.equal(controller.state(agent.session.id).job.phase, 'done');
    assert.deepEqual(adapter.compactModels, ['fast']);
    assert.equal(agent.session.requestHeader()?.config.model, 'working');
  } finally { await ctx.fiber.dispose(); }
});
test('unload removes only owned wrappers and restores official methods', async () => {
  const { ctx, agent, owner } = await fixture();
  try {
    const engine = agent.ctx.get('compaction')!;
    assert.ok(Object.getOwnPropertyDescriptor(engine, 'compactRegion'));
    assert.ok(Object.getOwnPropertyDescriptor(ctx.tokenMeter, 'measure'));
    await owner.dispose();
    assert.equal(Object.getOwnPropertyDescriptor(engine, 'compactRegion'), undefined);
    assert.equal(Object.getOwnPropertyDescriptor(engine, 'compactIfNeeded'), undefined);
    assert.equal(Object.getOwnPropertyDescriptor(engine, 'compactNow'), undefined);
    assert.equal(Object.getOwnPropertyDescriptor(ctx.tokenMeter, 'measure'), undefined);
  } finally { await ctx.fiber.dispose(); }
});
test('impossible usage is corrected in the public meter without rewriting history or billing', async () => {
  const { ctx, agent, controller, owner } = await fixture(8_000_000);
  try {
    const events = JSON.stringify(agent.session.snapshotEvents());
    const billing = structuredClone(ctx.sessionProjections.stateOf(agent.session, 'tokenUsage'));
    const view = await controller.context(agent.session.id);
    assert.equal(view?.corrected, true);
    assert.equal(view?.reason, 'invalid-usage');
    assert.ok(view!.reportedTokens >= 8_000_000);
    assert.ok(view!.usedTokens < 10_000);
    assert.equal(ctx.tokenMeter.measure(agent.session).totalTokens, view!.usedTokens);
    assert.equal(JSON.stringify(agent.session.snapshotEvents()), events);
    assert.deepEqual(ctx.sessionProjections.stateOf(agent.session, 'tokenUsage'), billing);
    await owner.dispose();
    assert.ok(ctx.tokenMeter.measure(agent.session).totalTokens >= 8_000_000);
  } finally { await ctx.fiber.dispose(); }
});
test('ordinary provider calibration remains authoritative even above the text estimate', async () => {
  const { ctx, agent, controller } = await fixture(80_000);
  try {
    const view = await controller.context(agent.session.id);
    assert.equal(view?.corrected, false);
    assert.ok(view!.usedTokens >= 80_000);
    assert.equal(ctx.tokenMeter.measure(agent.session).baseline.kind, 'usage');
  } finally { await ctx.fiber.dispose(); }
});
test('corrected pressure avoids useless automatic calls; real context-overflow still compacts', async () => {
  const { ctx, agent, adapter } = await fixture(8_000_000);
  try {
    let checked = false;
    agent.ctx.on('agent/pre-step', async ({ signal }, next) => {
      if (!checked) {
        checked = true;
        const engine = agent.ctx.get('compaction')!;
        assert.equal(await engine.compactIfNeeded(agent, 'pressure', signal), null);
        assert.deepEqual(adapter.compactModels, []);
        adapter.failWorking = false;
        const result = await engine.compactIfNeeded(agent, 'context-overflow', signal);
        assert.ok(result);
        assert.ok(adapter.compactModels.includes('working'));
      }
      return next();
    });
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Continue.' }], source: { kind: 'user' } })); await agent.whenIdle();
    assert.ok(checked);
    assert.ok(adapter.compactModels.includes('working'));
  } finally { await ctx.fiber.dispose(); }
});
test('inflated provider usage does not become fixed overhead or prevent manual rescue', async () => {
  const { ctx, agent, adapter, controller } = await fixture(8_000_000);
  try {
    const before = ctx.tokenMeter.measure(agent.session);
    assert.ok(before.totalTokens >= 8_000_000);
    assert.ok(before.surfaceTokens < 10_000);
    controller.request(agent.session.id, 'configured');
    for (let i = 0; i < 100 && ['queued', 'running'].includes(controller.state(agent.session.id).job.phase); i++) await new Promise(r => setTimeout(r, 5));
    const job = controller.state(agent.session.id).job;
    assert.equal(job.phase, 'done', job.message);
    assert.deepEqual(adapter.compactModels, ['fast']);
    assert.equal(job.beforeTokens, before.surfaceTokens);
    assert.ok(job.afterTokens! < job.beforeTokens!);
    assert.equal(agent.session.requestHeader()?.config.model, 'working');
  } finally { await ctx.fiber.dispose(); }
});
test('actual oversized tools still prevent a summary that cannot fit the working model', async () => {
  const { ctx, agent, adapter, controller } = await fixture();
  try {
    agent.session.append('request/header', { reason: 'initial', header: {
      ...agent.session.requestHeader()!, tools: [{ name: 'huge', description: 'schema '.repeat(50_000), parameters: { type: 'object' } }],
    } });
    controller.request(agent.session.id, 'configured');
    for (let i = 0; i < 100 && ['queued', 'running'].includes(controller.state(agent.session.id).job.phase); i++) await new Promise(r => setTimeout(r, 5));
    const job = controller.state(agent.session.id).job;
    assert.equal(job.phase, 'failed');
    assert.match(job.message, /工具定义和输出预留/);
    assert.deepEqual(adapter.compactModels, []);
  } finally { await ctx.fiber.dispose(); }
});
test('a manual click during a running step queues, then compacts at the safe boundary', async () => {
  const { ctx, agent, adapter, controller } = await fixture();
  try {
    let release!: () => void; adapter.gate = new Promise(resolve => { release = resolve; });
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'One final response.' }], source: { kind: 'user' } }));
    for (let i = 0; i < 100 && agent.status === 'idle'; i++) await new Promise(r => setTimeout(r, 2));
    assert.equal(agent.status, 'running');
    assert.equal(controller.request(agent.session.id, 'configured').job.phase, 'queued');
    assert.equal(adapter.compactModels.length, 0);
    release(); await agent.whenIdle();
    for (let i = 0; i < 100 && ['queued', 'running'].includes(controller.state(agent.session.id).job.phase); i++) await new Promise(r => setTimeout(r, 5));
    assert.equal(controller.state(agent.session.id).job.phase, 'done');
    assert.deepEqual(adapter.compactModels, ['fast']);
  } finally { await ctx.fiber.dispose(); }
});
test('rescue failure never switches models; explicit current-model retry is one attempt only', async () => {
  const { ctx, agent, adapter, controller } = await fixture();
  try {
    adapter.failRescue = true;
    controller.request(agent.session.id, 'configured');
    for (let i = 0; i < 100 && ['queued', 'running'].includes(controller.state(agent.session.id).job.phase); i++) await new Promise(r => setTimeout(r, 5));
    assert.equal(controller.state(agent.session.id).job.phase, 'failed');
    assert.match(controller.state(agent.session.id).job.message, /rescue model unavailable/);
    assert.deepEqual(adapter.compactModels, ['fast']);
    adapter.failWorking = false;
    controller.request(agent.session.id, 'current');
    for (let i = 0; i < 100 && ['queued', 'running'].includes(controller.state(agent.session.id).job.phase); i++) await new Promise(r => setTimeout(r, 5));
    assert.deepEqual(adapter.compactModels, ['fast', 'working']);
    assert.equal(controller.state(agent.session.id).config.model, 'fast');
    assert.equal(controller.state(agent.session.id).job.phase, 'done');
  } finally { await ctx.fiber.dispose(); }
});

test('direct mode uses the dedicated model on the first automatic overflow, with a durable transaction', async () => {
  const { ctx, agent, adapter, controller } = await fixture(undefined, 'direct');
  try {
    let checked = false;
    agent.ctx.on('agent/pre-step', async ({ signal }, next) => {
      if (!checked) {
        checked = true;
        const before = agent.session.surface.replaceGeneration;
        const result = await agent.ctx.get('compaction')!.compactIfNeeded(agent, 'context-overflow', signal);
        assert.ok(result?.summarySeq);
        assert.ok(agent.session.surface.replaceGeneration > before);
        assert.deepEqual(adapter.compactModels, ['fast']);
        assert.equal(controller.state(agent.session.id).job.phase, 'done');
      }
      return next();
    });
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Continue.' }], source: { kind: 'user' } })); await agent.whenIdle();
    assert.ok(checked); assert.deepEqual(adapter.compactModels, ['fast']);
    assert.equal(agent.session.requestHeader()?.config.model, 'working');
    const events = agent.session.snapshotEvents();
    assert.ok(events.some(e => e.type === 'compaction/summary'));
    assert.ok(events.some(e => e.type === 'compaction/end' && !e.data.error));
  } finally { await ctx.fiber.dispose(); }
});

for (const [mode, enabled] of [['rescue', true], ['direct', true], ['legacy', true], ['rescue', false]] as const) test(`native manual compactNow uses Saviour with ${mode}, automatic enabled=${enabled}`, async () => {
  const { ctx, agent, adapter } = await fixture(undefined, mode, enabled);
  try {
    const result = await agent.ctx.get('compaction')!.compactNow(agent, new AbortController().signal, 'test-command' as never);
    assert.ok(result?.summarySeq);
    assert.deepEqual(adapter.compactModels, ['fast']);
    const end = agent.session.snapshotEvents().find(e => e.type === 'compaction/end');
    assert.equal((end?.data as any).sourceCommandId, 'test-command');
    assert.equal(agent.session.requestHeader()?.config.model, 'working');
  } finally { await ctx.fiber.dispose(); }
});

test('direct failure blocks automatic repeat calls until an explicit choice; cancellation releases the block', async () => {
  const { ctx, agent, adapter, controller } = await fixture(undefined, 'direct');
  try {
    adapter.failRescue = true;
    let checked = false;
    agent.ctx.on('agent/pre-step', async ({ signal }, next) => {
      if (!checked) {
        checked = true;
        const engine = agent.ctx.get('compaction')!;
        const before = agent.session.surface.replaceGeneration;
        await assert.rejects(engine.compactIfNeeded(agent, 'context-overflow', signal));
        assert.equal(agent.session.surface.replaceGeneration, before);
        assert.equal(await engine.compactIfNeeded(agent, 'context-overflow', signal), null);
        assert.deepEqual(adapter.compactModels, ['fast']);
        controller.request(agent.session.id, 'cancel');
        adapter.failRescue = false;
        assert.ok(await engine.compactIfNeeded(agent, 'context-overflow', signal));
      }
      return next();
    });
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Continue.' }], source: { kind: 'user' } })); await agent.whenIdle();
    assert.ok(checked); assert.deepEqual(adapter.compactModels, ['fast', 'fast']);
  } finally { await ctx.fiber.dispose(); }
});
