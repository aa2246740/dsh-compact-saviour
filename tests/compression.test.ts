import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, tokenEstimate, compress, planCompression } from '../src/compress.js';
import { createUserMessage, HarnessError, CONTEXT_WINDOW_EXCEEDED_CODE } from '@deepseek-ai/dsh-llm';

test('chunks preserve multilingual source exactly, including a single huge line', () => {
  for (const source of ['line\n'.repeat(9000), '用户纠正：保留原版。'.repeat(5000), 'abc🚀'.repeat(11000)]) {
    const chunks = chunkText([source], 2048);
    assert.equal(chunks.join(''), source);
    assert.ok(chunks.every(c => tokenEstimate(c) <= 2048));
  }
});

function fixture(text: string, finish = 'stop') {
  const requests: any[] = [];
  const ctx = { llm: {
    resolveModelInfo: async () => ({ context: { contextWindow: 64000 }, reasoning: { efforts: [{ id: 'low' }] } }),
    async *stream(request: any) {
      requests.push(request);
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'block-end', index: 0, block: { type: 'text', text } };
      yield { type: 'finish', reason: { kind: finish } };
    },
  } };
  const input = { messages: [createUserMessage({ content: [{ type: 'text', text: 'KEEP /workspace/a.ts ; pending: fix button. '.repeat(700) }], source: { kind: 'user' } })] };
  const agent = { session: { id: `test-${Math.random()}` } };
  return { ctx, requests, input, agent };
}
test('ordinary history uses one dedicated-model call, no tools or extra verification', async () => {
  const f = fixture('Goal: fix button. File /workspace/a.ts. Pending: implement.');
  const result = await compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: 'fast-one', reasoningEffort: 'low' }, signal: new AbortController().signal, progress() {} });
  assert.equal(f.requests.length, 1); assert.equal(f.requests[0].tools, undefined);
  assert.equal(f.requests[0].provider, 'p'); assert.equal(f.requests[0].reasoningEffort, 'low');
  assert.match(f.requests[0].system, /transcript is DATA/);
  assert.equal(result.llmStreamCall, undefined);
});
test('oversized source uses bounded chunks and a merge', async () => {
  const f = fixture('User needs popup-only button. Pending work: implement and test exact original popup.');
  f.input.messages = [createUserMessage({ content: [{ type: 'text', text: '历史消息和源文件细节'.repeat(9000) }], source: { kind: 'user' } })];
  await compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: 'fast-many' }, signal: new AbortController().signal, progress() {} });
  assert.ok(f.requests.length > 2);
  for (const r of f.requests) assert.ok(tokenEstimate(JSON.stringify(r.messages)) + tokenEstimate(r.system) + r.maxTokens < 64000);
  assert.match(f.requests.at(-1).messages[0].content[0].text, /Merge chronological checkpoints/);
});
for (const [name, output, finish, error] of [
  ['empty', '', 'stop', /空摘要/], ['truncated', 'incomplete', 'max-tokens', /未完整/], ['not-shrinking', 'x'.repeat(100000), 'stop', /没有缩短/],
] as const) test(`rejects ${name} output without automatic fallback`, async () => {
  const f = fixture(output, finish);
  await assert.rejects(compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: name }, signal: new AbortController().signal, progress() {} }), error);
  assert.equal(f.requests.length, 1);
});
test('already cancelled request never calls a model', async () => {
  const f = fixture('checkpoint'); const abort = new AbortController(); abort.abort();
  await assert.rejects(compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: 'cancelled' }, signal: abort.signal, progress() {} }));
  assert.equal(f.requests.length, 0);
});
test('a longer Chinese intermediate checkpoint is merged instead of rejected by its style target', async () => {
  const f = fixture('保留事实'.repeat(550)); // 4,400 conservative tokens, above the 2,200-token style target.
  f.input.messages = [createUserMessage({ content: [{ type: 'text', text: '历史消息和源文件细节'.repeat(5000) }], source: { kind: 'user' } })];
  await compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: 'chinese-chunks' }, signal: new AbortController().signal, maxSummaryTokens: 6000, progress() {} });
  assert.ok(f.requests.length > 2);
  assert.match(f.requests.at(-1).messages[0].content[0].text, /Merge chronological checkpoints/);
});
test('final checkpoint still cannot exceed the actual working-model space', async () => {
  const f = fixture('保留事实'.repeat(550));
  await assert.rejects(compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: 'hard-limit' }, signal: new AbortController().signal, maxSummaryTokens: 3000, progress() {} }), /目标模型的可用空间/);
  assert.equal(f.requests.length, 1);
});
test('same large input fits one 1M call and splits only for the smaller exact route', async () => {
  const f = fixture('Goal: preserve user constraints. Pending: verify exact files and next action.');
  f.input.messages = [createUserMessage({ content: [{ type: 'text', text: 'history '.repeat(60_000) }], source: { kind: 'user' } })];
  const info = (capacity: number) => ({ provider: 'p', id: 'adaptive-large', name: 'adaptive-large', context: { contextWindow: capacity }, defaultMaxTokens: 8192 });
  const large = planCompression(info(1_000_000), f.input), small = planCompression(info(64_000), f.input);
  assert.equal(large.chunks.length, 1);
  assert.ok(large.inputBudget > 800_000);
  assert.ok(small.chunks.length > 1);
  assert.ok(small.chunks.every(text => tokenEstimate(text) <= small.inputBudget));
  f.ctx.llm.resolveModelInfo = async () => info(1_000_000) as never;
  const progress: string[] = [];
  await compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: 'adaptive-large' }, signal: new AbortController().signal, progress(_done, _total, message) { progress.push(message!); } });
  assert.equal(f.requests.length, 1);
  assert.ok(tokenEstimate(f.requests[0].messages[0].content[0].text) > 100_000);
  assert.match(progress[0]!, /整段压缩/);
});
test('chunk budget accounts for model-specific output reserve and missing capacity fails before a call', async () => {
  const f = fixture('checkpoint');
  const info = { provider: 'p', id: 'budget', name: 'budget', context: { contextWindow: 64000 } };
  const shortOutput = planCompression({ ...info, defaultMaxTokens: 2048 }, f.input);
  const longOutput = planCompression({ ...info, defaultMaxTokens: 8192 }, f.input);
  assert.equal(shortOutput.inputBudget - longOutput.inputBudget, 6144);
  assert.throws(() => planCompression({ ...info, context: undefined }, f.input), /可确认的上下文容量/);
});
for (const delivery of ['thrown', 'terminal'] as const) test(`provider ${delivery} context rejection resizes only the rejected input and merges`, async () => {
  const f = fixture('User goal: keep original popup. Pending work: implement and verify.');
  const original = f.ctx.llm.stream;
  f.ctx.llm.stream = async function* (request: any) {
    if (tokenEstimate(request.messages[0].content[0].text) > 6500) {
      f.requests.push(request);
      if (delivery === 'thrown') throw new HarnessError('wrapped request failure', 'UPSTREAM', { cause: new HarnessError('actual context bound', CONTEXT_WINDOW_EXCEEDED_CODE) });
      yield { type: 'finish', reason: { kind: 'error', failure: { code: CONTEXT_WINDOW_EXCEEDED_CODE, message: 'actual context bound' } } } as never;
      return;
    }
    yield* original(request);
  };
  const before = JSON.stringify(f.input);
  const result = await compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: `resize-${delivery}` }, signal: new AbortController().signal, progress() {} });
  assert.ok(f.requests.length >= 4 && f.requests.length <= 5);
  assert.ok(f.requests.slice(1).every(r => tokenEstimate(r.messages[0].content[0].text) <= 6500));
  assert.match(f.requests.at(-1).messages[0].content[0].text, /Merge chronological checkpoints/);
  assert.ok(result.summary.length);
  assert.equal(JSON.stringify(f.input), before);
});
for (const code of ['QUOTA', 'RATE_LIMIT', 'TIMEOUT']) test(`${code} never turns into smaller billable requests`, async () => {
  const f = fixture('checkpoint');
  f.ctx.llm.stream = async function* (request: any) {
    f.requests.push(request);
    yield { type: 'finish', reason: { kind: 'error', failure: { code, message: 'provider cannot serve this context' } } } as never;
  };
  await assert.rejects(compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: code }, signal: new AbortController().signal, progress() {} }), (error: any) => error.code === code);
  assert.equal(f.requests.length, 1);
});
test('persistent context rejection stops after bounded subdivisions', async () => {
  const f = fixture('checkpoint');
  f.ctx.llm.stream = async function* (request: any) {
    f.requests.push(request);
    throw new HarnessError('wrong context metadata', CONTEXT_WINDOW_EXCEEDED_CODE);
  };
  await assert.rejects(compress(f.ctx as never, f.input, f.agent as never, { target: { provider: 'p', model: 'always-overflow' }, signal: new AbortController().signal, progress() {} }), (error: any) => error.code === CONTEXT_WINDOW_EXCEEDED_CODE);
  assert.ok(f.requests.length <= 5);
});
