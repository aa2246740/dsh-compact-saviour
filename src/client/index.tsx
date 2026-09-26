import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import type {} from '@deepseek-ai/dsh-client-ui-slots';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Config, ModelOption, State } from '../shared.js';
import { MeterBridge } from './meter-bridge.js';
import { RingControl } from './ring-control.js';
import { WaitingCopy } from './waiting-copy.js';
import { contextRoot, contextRing, contextPanel } from './context-elements.js';
import './style.css';

export const name = 'dsh-compact-saviour-client';
export const inject = ['slots'];
const ENDPOINT = '/api/dsh-compact-saviour/v1';
async function api<T>(params = '', data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(ENDPOINT + params, { credentials: 'same-origin', signal,
    ...(data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {}),
  });
  const text = await response.text();
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error(`压缩服务暂未就绪（HTTP ${response.status}），请稍后重试。`); }
  if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
  return value;
}

/** A zero-layout anchor scopes the native ring gesture, status animation and popup. */
export function PopupBridge({ sessionId }: { sessionId: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState<State>();
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const posting = useRef(false);
  const act = useRef<(action: string) => Promise<void>>(async () => {});
  const latest = useRef<State>();
  const syncMeter = useRef<() => void>(() => {});
  useEffect(() => {
    const abort = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    let revision = 0, connectionError = '';
    setState(undefined); latest.current = undefined; setError(''); setSending(false); posting.current = false;
    const update = (value: State) => { latest.current = value; setState(value); syncMeter.current(); };
    act.current = async (action: string) => {
      if (posting.current || abort.signal.aborted) return;
      posting.current = true; revision++; setSending(true); setError(''); syncMeter.current();
      try {
        const value = await api<State>('', { action, sessionId }, abort.signal);
        // POST acknowledges a job without remeasuring context. Keep the last
        // same-session reading until GET replaces it, avoiding an 8M flash.
        if (!abort.signal.aborted) update({ ...value, context: value.context ?? latest.current?.context });
      } catch (e) {
        if (!abort.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!abort.signal.aborted) { posting.current = false; revision++; setSending(false); syncMeter.current(); }
      }
    };
    const poll = async () => {
      const started = revision;
      try {
        const value = await api<State>(`?sessionId=${encodeURIComponent(sessionId)}`, undefined, abort.signal);
        if (!abort.signal.aborted && started === revision && !posting.current) {
          update(value); const previous = connectionError;
          setError(current => current === previous ? '' : current); connectionError = '';
        }
      } catch (e) {
        if (!abort.signal.aborted) { connectionError = e instanceof Error ? e.message : String(e); setError(connectionError); }
      }
      if (!abort.signal.aborted) timer = setTimeout(poll, 1000);
    };
    void poll(); return () => { abort.abort(); clearTimeout(timer); act.current = async () => {}; };
  }, [sessionId]);
  useEffect(() => {
    const root = anchor.current && contextRoot(anchor.current);
    if (!root) return;
    let owned: HTMLDivElement | null = null;
    let observedPanel: HTMLElement | undefined;
    const meter = new MeterBridge();
    let control: RingControl | undefined;
    const sync = () => {
      const ring = contextRing(root);
      const panel = contextPanel(ring);
      if (panel !== observedPanel) {
        panelObserver.disconnect(); observedPanel = panel;
        if (panel) panelObserver.observe(panel, observeOptions);
      }
      meter.apply(ring, latest.current?.context);
      if (control?.button !== ring) {
        control?.destroy(); control = ring ? new RingControl(ring, () => { void act.current('configured'); }) : undefined;
      }
      control?.update(posting.current ? 'sending' : latest.current?.job.phase ?? 'idle', Boolean(latest.current?.available));
      if (owned && owned.parentElement === panel) {
        // The optional breakdown can arrive after the portal footer. React
        // appends its new rows last; keep our action beneath those native rows.
        if (panel && panel.lastElementChild !== owned) panel.append(owned);
        return;
      }
      owned?.remove(); owned = null;
      if (panel && !panel.querySelector('[data-compact-saviour]')) {
        owned = document.createElement('div'); owned.dataset.compactSaviour = 'footer'; owned.className = 'dsh-cs-footer'; panel.append(owned);
      }
      setFooter(owned);
    };
    const observeOptions = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-label', 'aria-describedby', 'stroke-dasharray', 'style'] };
    const observer = new MutationObserver(sync);
    const panelObserver = new MutationObserver(sync);
    const portals = new MutationObserver(sync);
    observer.observe(root, observeOptions);
    // Only direct body children, not the streaming transcript subtree.
    portals.observe(root.ownerDocument.body, { childList: true });
    syncMeter.current = sync; sync();
    return () => { syncMeter.current = () => {}; observer.disconnect(); portals.disconnect(); panelObserver.disconnect(); control?.destroy(); meter.restore(); owned?.remove(); };
  }, [sessionId]);
  return <><span ref={anchor} style={{ display: 'none' }} aria-hidden="true" />{footer && createPortal(<CompactFooter state={state} sending={sending} error={error} act={action => act.current(action)} />, footer)}</>;
}

function CompactFooter({ state, sending, error, act }: {
  state?: State; sending: boolean; error: string; act(action: string): Promise<void>;
}) {
  const job = state?.job, active = job?.phase === 'queued' || job?.phase === 'running';
  const current = job?.current;
  const busy = sending || active;
  const running = !sending && job?.phase === 'running';
  const stage = job?.message.includes('合并摘要') ? 'merge' : 'compress';
  const label = sending ? '正在提交' : job?.phase === 'queued' ? '等待当前步骤结束' : job?.phase === 'running'
    ? stage === 'merge' ? '正在合并摘要' : '正在压缩' : '手动压缩';
  const progress = !sending && job?.phase === 'running' && Number.isInteger(job.completed) && Number.isInteger(job.total)
    && job.total! > 1 && job.completed! >= 0 && job.completed! <= job.total! ? `${job.completed}/${job.total}` : '';
  return <div className="dsh-cs-content" data-phase={sending ? 'sending' : job?.phase ?? 'idle'}>
    <button className="dsh-cs-button dsh-cs-primary dsh-cs-compact" type="button" aria-label={progress ? `${label} ${progress}` : label} disabled={sending || !state?.available || active} onClick={() => void act('configured')}>
      <span className="dsh-cs-button-status" aria-hidden="true">
        {running ? <WaitingCopy key={stage} stage={stage} /> : <span className="dsh-cs-label">{label}{busy ? '…' : ''}</span>}
        {progress && <span className="dsh-cs-progress"> {progress}</span>}
      </span>
      <span className="dsh-cs-sr-status" role="status" aria-live="polite" aria-atomic="true">{label}{progress ? ` ${progress}` : ''}</span>
    </button>
    {!active && !sending && <div className="dsh-cs-hint">也可以长按圆环直接压缩</div>}
    {!busy && job?.message && <div className="dsh-cs-status dsh-cs-job-status" role="status"><span>{job.message}{job.phase === 'done' && job.beforeTokens !== undefined && job.afterTokens !== undefined ? ` ${Math.round(job.beforeTokens / 1000)}K → ${Math.round(job.afterTokens / 1000)}K` : ''}</span></div>}
    {state?.context?.corrected && <div className="dsh-cs-status">{state.context.reason === 'invalid-usage' ? '已排除异常历史用量，当前按消息和工具估算。' : '已按新模型的上下文容量重新估算。'}</div>}
    {error && <div className="dsh-cs-error" role="alert">{error}</div>}
    {state && !state.config.model && !error && <div className="dsh-cs-status">先在设置 → Compact Saviour 中选择压缩模型。</div>}
    {state && !state.available && <div className="dsh-cs-status">当前会话的 Compact 后端尚未就绪。</div>}
    {job?.phase === 'failed' && <div className="dsh-cs-actions">
      <button className="dsh-cs-button" disabled={sending} onClick={() => void act('configured')}>重试压缩模型</button>
      {current && <button className="dsh-cs-button" disabled={sending} onClick={() => void act('current')}>本次使用 {current.model} · {current.reasoningEffort || '默认推理'}</button>}
    </div>}
    {(active || job?.phase === 'failed') && <button className="dsh-cs-button" disabled={sending} onClick={() => void act('cancel')}>取消</button>}
  </div>;
}

function SettingsPanel() {
  const [config, setConfig] = useState<Config>();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [search, setSearch] = useState('');
  const [efforts, setEfforts] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([api<State>('', undefined, abort.signal), api<{ models: ModelOption[] }>('?models=1', undefined, abort.signal)])
      .then(([s, m]) => { setConfig(s.config); setModels(m.models); })
      .catch(e => { if (!abort.signal.aborted) setMessage(e.message); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const abort = new AbortController(); setEfforts([]);
    if (config?.provider && config.model) void api<{ efforts: { id: string; name: string }[] }>(`?provider=${encodeURIComponent(config.provider)}&model=${encodeURIComponent(config.model)}`, undefined, abort.signal)
      .then(v => setEfforts(v.efforts)).catch(e => { if (!abort.signal.aborted) setMessage(e.message); });
    return () => abort.abort();
  }, [config?.provider, config?.model]);
  const save = async () => {
    setSaving(true); setMessage('');
    try { const s = await api<State>('', { action: 'settings', config }); setConfig(s.config); setMessage('已保存。'); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  const selected = config?.model ? JSON.stringify([config.provider, config.model]) : '';
  const filtered = models.filter(m => JSON.stringify([m.provider, m.id]) === selected || `${m.name} ${m.id} ${m.provider}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="dsh-cs-settings">
    <h2>Compact Saviour</h2>
    <p>独立模型负责上下文压缩。点击圆环查看用量，长按圆环或点击弹层内的按钮开始压缩。</p>
    {config ? <>
      <label className="dsh-cs-toggle"><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} /> 启用自动压缩辅助</label>
      <label>自动压缩方式<select value={config.mode ?? 'rescue'} disabled={!config.enabled} onChange={e => setConfig({ ...config, mode: e.target.value as 'direct' | 'rescue' })}>
        <option value="rescue">官方连续失败两次后救援（默认）</option>
        <option value="direct">直接使用 Saviour 模型</option>
      </select></label>
      <p>{!config.enabled ? '自动压缩由官方处理。手动压缩仍直接使用下方模型。' : config.mode === 'direct' ? '自动和手动压缩都直接使用下方模型。' : '自动压缩先由官方处理，连续失败两次后静默救援。手动压缩直接使用下方模型。'}</p>
      <label>Saviour 压缩模型<input placeholder="搜索已配置的模型" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select aria-label="压缩模型" value={selected} onChange={e => { const [provider, model] = e.target.value ? JSON.parse(e.target.value) : ['', '']; setConfig({ ...config, provider, model, reasoningEffort: '' }); }}>
        <option value="">请选择模型</option>
        {filtered.map(m => <option key={JSON.stringify([m.provider, m.id])} value={JSON.stringify([m.provider, m.id])}>{m.name} · {m.provider}</option>)}
      </select>
      <label>Reasoning level<select value={config.reasoningEffort} onChange={e => setConfig({ ...config, reasoningEffort: e.target.value })}>
        <option value="">模型默认</option>{efforts.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select></label>
      <p>超长历史自动分块，保留近期消息和原始记录。失败后由你选择重试、仅本次使用当前对话模型，或取消。</p>
      <button className="dsh-cs-button dsh-cs-primary" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</button>
    </> : <p>正在加载模型配置…</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right', id: 'compact-saviour-popup-anchor', order: 100,
    inject: (sessionId: string) => ({ sessionId }),
  }, PopupBridge));
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'compact-saviour', order: 38, label: () => 'Compact Saviour',
  }, SettingsPanel));
}
