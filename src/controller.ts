import { Context, type Fiber } from '@deepseek-ai/cordis';
import { scopeOf, scopeChainOf } from '@deepseek-ai/dsh-scope';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { errorChain } from '@deepseek-ai/dsh-llm';
import type { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';
import { SessionId } from '@deepseek-ai/dsh-session';
import type { SessionSeq } from '@deepseek-ai/dsh-session';
import type { CommandId } from '@deepseek-ai/dsh-commands/brand';
interface SettingsScope<T> { get(): T; replace(value: T): Promise<void> }
import type {} from '@deepseek-ai/dsh-api-session-controller';
import type {} from '@deepseek-ai/dsh-session-projection';
import { compactSurfaceRegion, selectCompactableRange } from './vendor/region.js';
import { compress } from './compress.js';
import { PressureMeter } from './pressure.js';
import type { Config, Target, State, JobView } from './shared.js';

type Engine = BasicCompactionEngine;
interface Binding { engine: Engine; ctx: Context; fiber: Fiber; restore(): void }
interface Job { view: JobView; pending?: Target; abort?: AbortController; blocked: boolean; work?: Promise<unknown> }
const inactive = (): Job => ({ view: { phase: 'idle', message: '', failures: 0 }, blocked: false });

export class Controller {
  private bindings = new Map<Fiber, Binding>();
  private jobs = new Map<string, Job>();
  private disposed = false;
  private pressure: PressureMeter;
  constructor(readonly ctx: Context, readonly settings: SettingsScope<Config>) {
    this.pressure = new PressureMeter(ctx);
    const scan = () => { if (!this.disposed) this.scan(); };
    ctx.on('internal/status', () => queueMicrotask(scan), { global: true });
    ctx.on('agent/created', async () => { scan(); }, { global: true });
    ctx.on('agent/disposed', ({ agent }) => { this.jobs.get(agent.session.id)?.abort?.abort(); this.jobs.delete(agent.session.id); }, { global: true });
    ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
      const job = this.jobs.get(agent.session.id);
      if (job?.pending) await this.runPending(agent, signal, false);
      return next();
    }, { global: true, prepend: true });
    ctx.on('agent/status', ({ agent, status }) => {
      if (status === 'idle' && this.jobs.get(agent.session.id)?.pending) queueMicrotask(() => { void this.runIdle(agent); });
    }, { global: true });
    ctx.effect(() => async () => {
      this.disposed = true;
      for (const job of this.jobs.values()) job.abort?.abort(new Error('插件已卸载。'));
      for (const b of this.bindings.values()) b.restore();
      await Promise.allSettled([...this.jobs.values()].map(j => j.work));
      this.jobs.clear(); this.bindings.clear();
    });
    scan();
  }
  private job(agent: Agent): Job {
    let job = this.jobs.get(agent.session.id);
    if (!job) { job = inactive(); this.jobs.set(agent.session.id, job); }
    return job;
  }
  private scan(): void {
    for (const [fiber, binding] of this.bindings) if (fiber.uid === null) { binding.restore(); this.bindings.delete(fiber); }
    for (const runtime of this.ctx.registry.values()) for (const fiber of runtime.fibers) {
      const entry = (fiber as Fiber & { entry?: { options: { name: string } } }).entry;
      if (fiber.uid === null || this.bindings.has(fiber) || entry?.options.name !== '@deepseek-ai/dsh-compaction-basic') continue;
      const engine = fiber.ctx.get('compaction') as Engine | undefined;
      if (!engine || typeof engine.compactRegion !== 'function' || typeof engine.compactIfNeeded !== 'function') continue;
      // Per-instance public method decoration. No prototype, Loader row or core-file mutation.
      const originalRegion = engine.compactRegion;
      const originalIfNeeded = engine.compactIfNeeded;
      const ownRegion = Object.getOwnPropertyDescriptor(engine, 'compactRegion');
      const ownNeeded = Object.getOwnPropertyDescriptor(engine, 'compactIfNeeded');
      const ownNow = Object.getOwnPropertyDescriptor(engine, 'compactNow');
      const self = this;
      const region: Engine['compactRegion'] = async function(this: Engine, start, end, agent, signal) {
        const job = self.job(agent);
        if (job.blocked && self.settings.get().enabled) throw new Error('压缩救援等待用户选择重试或取消。');
        if (self.direct()) return self.rescue(agent, { engine, ctx: fiber.ctx, fiber, restore() {} }, self.configured(), signal ?? new AbortController().signal, false, { start, end });
        const generation = agent.session.surface.replaceGeneration;
        const firstEvent = agent.session.seq;
        try {
          const result = await originalRegion.call(this, start, end, agent, signal);
          job.view.failures = 0; return result;
        } catch (error) {
          // Never retry a partial commit, cancellation, or unmatched transaction.
          if (signal?.aborted || agent.session.surface.replaceGeneration !== generation) throw error;
          const events = agent.session.snapshotEvents(firstEvent);
          if (!events.some(e => e.type === 'compaction/end' && e.data.error)
            || events.some(e => e.type === 'compaction/summary')) throw error;
          job.view.failures++;
          if (!self.settings.get().enabled || job.view.failures < 2) throw error;
          const target = self.configured();
          return self.rescue(agent, { engine, ctx: fiber.ctx, fiber, restore() {} }, target, signal ?? new AbortController().signal, false);
        }
      };
      const needed: Engine['compactIfNeeded'] = async function(this: Engine, agent, trigger, signal) {
        if (self.job(agent).blocked && self.settings.get().enabled) return null;
        // Prime metadata before the official synchronous pressure check. Failure
        // to resolve it leaves the original check and context-overflow recovery intact.
        try { await self.pressure.refresh(agent.session, undefined, signal); } catch { if (signal?.aborted) throw signal.reason; }
        return originalIfNeeded.call(this, agent, trigger, signal);
      };
      const now: Engine['compactNow'] = function(this: Engine, agent, signal, sourceCommandId) {
        // Explicit manual compaction always uses Saviour, independently of the
        // automatic policy and its enable switch, just like the popup/long hold.
        signal.throwIfAborted();
        return agent.runMaintenance(agentSignal => self.rescue(agent, { engine, ctx: fiber.ctx, fiber, restore() {} }, self.configured(), AbortSignal.any([signal, agentSignal]), true, undefined, sourceCommandId));
      };
      engine.compactRegion = region; engine.compactIfNeeded = needed; engine.compactNow = now;
      this.bindings.set(fiber, { engine, ctx: fiber.ctx, fiber, restore() {
        if (Object.getOwnPropertyDescriptor(engine, 'compactRegion')?.value === region) {
          if (ownRegion) Object.defineProperty(engine, 'compactRegion', ownRegion); else Reflect.deleteProperty(engine, 'compactRegion');
        }
        if (Object.getOwnPropertyDescriptor(engine, 'compactIfNeeded')?.value === needed) {
          if (ownNeeded) Object.defineProperty(engine, 'compactIfNeeded', ownNeeded); else Reflect.deleteProperty(engine, 'compactIfNeeded');
        }
        if (Object.getOwnPropertyDescriptor(engine, 'compactNow')?.value === now) {
          if (ownNow) Object.defineProperty(engine, 'compactNow', ownNow); else Reflect.deleteProperty(engine, 'compactNow');
        }
      } });
    }
  }
  private binding(agent: Agent): Binding {
    this.scan();
    const chain = scopeChainOf(agent);
    const ranked = [...this.bindings.values()].map(b => {
      const scope = scopeOf(b.ctx);
      return { b, rank: scope === undefined ? chain.length : chain.indexOf(scope) };
    }).filter(x => x.rank >= 0).sort((a, b) => a.rank - b.rank);
    const matches = ranked.filter(x => x.rank === ranked[0]?.rank).map(x => x.b);
    if (matches.length !== 1) throw new Error(`当前会话的官方 Compact 后端未就绪（匹配 ${matches.length} 个）。`);
    return matches[0]!;
  }
  private configured(): Target {
    const { provider, model, reasoningEffort } = this.settings.get();
    return { provider, model, ...(reasoningEffort ? { reasoningEffort } : {}) };
  }
  private direct(): boolean { const config = this.settings.get(); return config.enabled && config.mode === 'direct'; }
  current(agent: Agent): Target | undefined {
    const projection = this.ctx.sessionProjections.stateOf(agent.session, 'modelSelection');
    const target = projection?.pending ?? projection?.lastUsed ?? agent.session.requestHeader()?.config ?? agent.options;
    return target.provider && target.model ? { provider: target.provider, model: target.model, ...(target.reasoningEffort ? { reasoningEffort: String(target.reasoningEffort) } : {}) } : undefined;
  }
  state(id?: string): State {
    const agent = id ? this.ctx.agents.get(SessionId(id)) : undefined;
    let available = false;
    if (agent) { try { this.binding(agent); available = true; } catch {} }
    return { config: this.settings.get(), available, job: { ...(agent ? this.job(agent).view : inactive().view), ...(agent && this.current(agent) ? { current: this.current(agent) } : {}) } };
  }
  async context(id?: string) {
    const agent = id ? this.ctx.agents.get(SessionId(id)) : undefined;
    if (!agent) return;
    const target = this.current(agent);
    try {
      const value = await this.pressure.refresh(agent.session, target);
      return JSON.stringify(target) === JSON.stringify(this.current(agent)) ? value : undefined;
    } catch { return undefined; }
  }
  request(id: string, mode: 'configured' | 'current' | 'cancel'): State {
    const agent = this.ctx.agents.get(SessionId(id));
    if (!agent) throw new Error('请先打开目标会话。');
    const job = this.job(agent);
    if (mode === 'cancel') {
      job.blocked = false;
      job.pending = undefined; job.abort?.abort(new Error('用户取消压缩。'));
      if (!job.abort) job.view = { phase: 'idle', message: '已取消压缩。', failures: job.view.failures };
      return this.state(id);
    }
    if (job.pending || job.abort) throw new Error('该会话已有压缩任务。');
    this.binding(agent);
    const target = mode === 'current' ? this.current(agent) : this.configured();
    if (!target?.provider || !target.model) throw new Error('请先在设置中选择压缩模型。');
    job.pending = target; job.blocked = false;
    job.view = { phase: 'queued', message: agent.status === 'idle' ? '正在准备压缩…' : '已排队，当前模型或工具步骤结束后压缩。', failures: job.view.failures };
    if (agent.status === 'idle') queueMicrotask(() => { void this.runIdle(agent); });
    return this.state(id);
  }
  private async runIdle(agent: Agent): Promise<void> {
    const job = this.job(agent);
    if (!job.pending || this.disposed) return;
    try { await agent.runMaintenance(signal => this.runPending(agent, signal, true)); }
    catch (error) {
      // A turn may win admission between the click and maintenance. Keep it queued for pre-step.
      if (agent.status !== 'idle') return;
      job.pending = undefined; this.fail(job, error);
    }
  }
  private async runPending(agent: Agent, signal: AbortSignal, idle: boolean): Promise<void> {
    const job = this.job(agent), target = job.pending;
    if (!target || this.disposed) return;
    job.pending = undefined;
    try { await this.rescue(agent, this.binding(agent), target, signal, idle); }
    catch (error) { if (!signal.aborted && job.view.phase === 'queued') this.fail(job, error); }
  }
  private fail(job: Job, error: unknown): void {
    job.blocked = true;
    job.view = { ...job.view, phase: 'failed', message: errorChain(error) };
  }
  private async rescue(agent: Agent, binding: Binding, target: Target, outerSignal: AbortSignal, idle: boolean, selected?: { start: SessionSeq; end: SessionSeq }, sourceCommandId?: CommandId) {
    const job = this.job(agent);
    if (job.abort) throw new Error('该会话已有压缩任务。');
    const abort = new AbortController(); job.abort = abort;
    const signal = AbortSignal.any([outerSignal, abort.signal]);
    const work = (async () => {
      try {
        signal.throwIfAborted();
        if (!target.provider || !target.model) throw new Error('请先在设置 → Compact Saviour 中选择压缩模型。');
        const meter = binding.ctx.tokenMeter;
        const current = this.current(agent);
        const header = agent.session.requestHeader();
        // Reprice retained images for the model selected for the next request.
        const effectiveHeader = header && current ? { ...header, config: { ...header.config, provider: current.provider, model: current.model } } : header;
        const before = meter.measure(agent.session, effectiveHeader);
        // Provider usage is a calibration anchor, not a measurement of immutable
        // overhead. In particular totalTokens - surfaceTokens may contain stale
        // usage or a provider's cumulative count. Price actual tool schemas instead.
        // Matches DSH token-meter's tool-schema heuristic; system messages are
        // already included in surfaceTokens and in the untouched nodes below.
        const tools = effectiveHeader?.tools;
        const fixed = tools?.length ? Math.ceil(JSON.stringify(tools).length / 4) + 4 : 0;
        const beforeTokens = fixed + before.surfaceTokens;
        job.view = { phase: 'running', message: '正在压缩上下文…', failures: job.view.failures, beforeTokens };
        const info = current ? await binding.ctx.llm.resolveModelInfo(current.provider, current.model, signal) : undefined;
        const contextWindow = info?.context?.contextWindow;
        if (!contextWindow) throw new Error('当前对话模型没有可确认的上下文容量。');
        const room = Math.floor(contextWindow * .75) - fixed - (effectiveHeader?.config.maxTokens ?? info?.defaultMaxTokens ?? 8192);
        if (room < 4000) throw new Error('系统提示词、工具定义和输出预留已占满目标模型空间，仅压缩消息无法容纳；请减少工具或选择更大上下文模型。');
        const retain = Math.min(12000, Math.floor(room * .3), Math.floor(before.surfaceTokens * .2));
        const range = selected ?? selectCompactableRange(agent.session, before, retain);
        if (!range) throw new Error('可安全压缩的历史不足，已保留最近消息。');
        const from = before.nodes.findIndex(n => n.seq === range.start), to = before.nodes.findIndex(n => n.seq === range.end);
        const untouched = before.nodes.reduce((sum, n, i) => sum + (i < from || i > to ? n.tokens : 0), 0);
        const maxSummaryTokens = Math.floor(room - untouched - 1000);
        if (maxSummaryTokens < 1500) throw new Error('保留的最新消息、系统提示和工具已超出目标模型预算；请减少工具或选择更大上下文模型。');
        const summaryBudget = Math.min(6000, maxSummaryTokens);
        const result = await compactSurfaceRegion({
          meter,
          summarize: (input, owner, abortSignal) => compress(binding.ctx, input, owner, { target, signal: abortSignal ?? signal, summaryBudget, maxSummaryTokens,
            progress: (completed, total, message) => { job.view = { ...job.view, completed, total, message: message ?? (total === 1 ? '正在生成摘要…' : `正在分块压缩 ${completed}/${total}…`) }; },
          }),
        }, agent.session, range.start, range.end, agent, { owner: idle ? null : 'current-turn', stability: idle ? 'selected-span' : 'whole-surface', ...(sourceCommandId ? { sourceCommandId } : {}), ...(idle ? { flush: async () => { await binding.ctx.sessions.flush(agent.session); } } : {}) }, signal);
        job.blocked = false;
        job.view = { phase: 'done', message: '压缩完成（按当前消息和工具估算）。', failures: 0, beforeTokens, afterTokens: fixed + meter.measure(agent.session, effectiveHeader).surfaceTokens };
        return result;
      } catch (error) {
        if (signal.aborted) job.view = { ...job.view, phase: 'idle', message: '压缩已取消，未完成的摘要不会写入。' };
        else this.fail(job, error);
        throw error;
      } finally { job.abort = undefined; job.work = undefined; }
    })();
    job.work = work;
    return work;
  }
}
