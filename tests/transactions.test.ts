import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import AgentLoop from '@deepseek-ai/dsh-agent-loop';
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit';
import TokenMeter from '@deepseek-ai/dsh-token-meter';
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { compactSurfaceRegion, selectCompactableRange } from '../src/vendor/region.js';

class MockAdapter extends LlmAdapter {
  async resolveModel(provider: string, model: string) { return { provider, id: model, name: model, context: { contextWindow: 100000 } }; }
  async *stream() {
    yield { type: 'block-start' as const, index: 0, blockType: 'text' as const };
    yield { type: 'block-end' as const, index: 0, block: { type: 'text' as const, text: 'acknowledged' } };
    yield { type: 'finish' as const, reason: { kind: 'stop' as const } };
  }
}
async function harness() {
  const ctx = new Context(); await mountAgentLoopTestDependencies(ctx);
  await ctx.plugin(AgentLoop, { agents: [] }); await ctx.plugin(TokenMeter);
  ctx.llm.registerAdapter(['mock'], new MockAdapter());
  const agent = await ctx.agentLoop.create(SessionId(`cs-${Math.random()}`), { provider: 'mock', model: 'mock' });
  for (const text of ['older history '.repeat(1000), 'recent exact request '.repeat(300)]) {
    agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle();
  }
  return { ctx, agent };
}
test('real session transaction preserves raw log and recent tail, records honest provenance', async () => {
  const { ctx, agent } = await harness();
  try {
    const raw = agent.session.snapshotEvents(), tail = agent.session.surface.nodes.at(-1);
    const range = selectCompactableRange(agent.session, ctx.tokenMeter.measure(agent.session), 1000)!;
    await agent.runMaintenance(signal => compactSurfaceRegion({ meter: ctx.tokenMeter, summarize: async () => ({ summary: [{ type: 'text', text: 'Historical state. User asked to continue.' }], provider: 'rescue', model: 'fast' }) }, agent.session, range.start, range.end, agent, { owner: null, stability: 'selected-span', flush: async () => { await ctx.sessions.flush(agent.session); } }, signal));
    assert.deepEqual(agent.session.snapshotEvents().slice(0, raw.length), raw);
    assert.ok(agent.session.surface.nodes.includes(tail!));
    const summary = agent.session.snapshotEvents().find(e => e.type === 'compaction/summary');
    assert.equal(summary?.data.model, 'fast'); assert.equal(summary?.data.llmStreamCall, undefined);
  } finally { await ctx.fiber.dispose(); }
});
test('failed or nonshrinking summary leaves visible history unchanged and closes official bracket', async () => {
  for (const scenario of ['failure', 'nonshrinking']) {
    const { ctx, agent } = await harness();
    try {
      const before = [...agent.session.surface.nodes];
      const range = selectCompactableRange(agent.session, ctx.tokenMeter.measure(agent.session), 0)!;
      await assert.rejects(agent.runMaintenance(signal => compactSurfaceRegion({ meter: ctx.tokenMeter, summarize: async () => {
        if (scenario === 'failure') throw new Error('quota exhausted');
        return { summary: [{ type: 'text', text: 'large '.repeat(10000) }], provider: 'rescue', model: 'fast' };
      } }, agent.session, range.start, range.end, agent, { owner: null, stability: 'selected-span' }, signal)));
      assert.deepEqual(agent.session.surface.nodes, before);
      assert.equal(agent.session.snapshotEvents().at(-1)?.type, 'compaction/end');
      assert.equal(agent.session.snapshotEvents().filter(e => e.type === 'compaction/summary').length, 0);
    } finally { await ctx.fiber.dispose(); }
  }
});
