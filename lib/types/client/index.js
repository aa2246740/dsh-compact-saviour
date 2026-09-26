import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MeterBridge } from './meter-bridge.js';
import { RingControl } from './ring-control.js';
import { WaitingCopy } from './waiting-copy.js';
import { contextRoot, contextRing, contextPanel } from './context-elements.js';
import './style.css';
export const name = 'dsh-compact-saviour-client';
export const inject = ['slots'];
const ENDPOINT = '/api/dsh-compact-saviour/v1';
async function api(params = '', data, signal) {
    const response = await fetch(ENDPOINT + params, { credentials: 'same-origin', signal,
        ...(data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {}),
    });
    const text = await response.text();
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new Error(`压缩服务暂未就绪（HTTP ${response.status}），请稍后重试。`);
    }
    if (!response.ok)
        throw new Error(value.error ?? `HTTP ${response.status}`);
    return value;
}
/** A zero-layout anchor scopes the native ring gesture, status animation and popup. */
export function PopupBridge({ sessionId }) {
    const anchor = useRef(null);
    const [footer, setFooter] = useState(null);
    const [state, setState] = useState();
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const posting = useRef(false);
    const act = useRef(async () => { });
    const latest = useRef();
    const syncMeter = useRef(() => { });
    useEffect(() => {
        const abort = new AbortController();
        let timer;
        let revision = 0, connectionError = '';
        setState(undefined);
        latest.current = undefined;
        setError('');
        setSending(false);
        posting.current = false;
        const update = (value) => { latest.current = value; setState(value); syncMeter.current(); };
        act.current = async (action) => {
            if (posting.current || abort.signal.aborted)
                return;
            posting.current = true;
            revision++;
            setSending(true);
            setError('');
            syncMeter.current();
            try {
                const value = await api('', { action, sessionId }, abort.signal);
                // POST acknowledges a job without remeasuring context. Keep the last
                // same-session reading until GET replaces it, avoiding an 8M flash.
                if (!abort.signal.aborted)
                    update({ ...value, context: value.context ?? latest.current?.context });
            }
            catch (e) {
                if (!abort.signal.aborted)
                    setError(e instanceof Error ? e.message : String(e));
            }
            finally {
                if (!abort.signal.aborted) {
                    posting.current = false;
                    revision++;
                    setSending(false);
                    syncMeter.current();
                }
            }
        };
        const poll = async () => {
            const started = revision;
            try {
                const value = await api(`?sessionId=${encodeURIComponent(sessionId)}`, undefined, abort.signal);
                if (!abort.signal.aborted && started === revision && !posting.current) {
                    update(value);
                    const previous = connectionError;
                    setError(current => current === previous ? '' : current);
                    connectionError = '';
                }
            }
            catch (e) {
                if (!abort.signal.aborted) {
                    connectionError = e instanceof Error ? e.message : String(e);
                    setError(connectionError);
                }
            }
            if (!abort.signal.aborted)
                timer = setTimeout(poll, 1000);
        };
        void poll();
        return () => { abort.abort(); clearTimeout(timer); act.current = async () => { }; };
    }, [sessionId]);
    useEffect(() => {
        const root = anchor.current && contextRoot(anchor.current);
        if (!root)
            return;
        let owned = null;
        let observedPanel;
        const meter = new MeterBridge();
        let control;
        const sync = () => {
            const ring = contextRing(root);
            const panel = contextPanel(ring);
            if (panel !== observedPanel) {
                panelObserver.disconnect();
                observedPanel = panel;
                if (panel)
                    panelObserver.observe(panel, observeOptions);
            }
            meter.apply(ring, latest.current?.context);
            if (control?.button !== ring) {
                control?.destroy();
                control = ring ? new RingControl(ring, () => { void act.current('configured'); }) : undefined;
            }
            control?.update(posting.current ? 'sending' : latest.current?.job.phase ?? 'idle', Boolean(latest.current?.available));
            if (owned && owned.parentElement === panel) {
                // The optional breakdown can arrive after the portal footer. React
                // appends its new rows last; keep our action beneath those native rows.
                if (panel && panel.lastElementChild !== owned)
                    panel.append(owned);
                return;
            }
            owned?.remove();
            owned = null;
            if (panel && !panel.querySelector('[data-compact-saviour]')) {
                owned = document.createElement('div');
                owned.dataset.compactSaviour = 'footer';
                owned.className = 'dsh-cs-footer';
                panel.append(owned);
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
        syncMeter.current = sync;
        sync();
        return () => { syncMeter.current = () => { }; observer.disconnect(); portals.disconnect(); panelObserver.disconnect(); control?.destroy(); meter.restore(); owned?.remove(); };
    }, [sessionId]);
    return _jsxs(_Fragment, { children: [_jsx("span", { ref: anchor, style: { display: 'none' }, "aria-hidden": "true" }), footer && createPortal(_jsx(CompactFooter, { state: state, sending: sending, error: error, act: action => act.current(action) }), footer)] });
}
function CompactFooter({ state, sending, error, act }) {
    const job = state?.job, active = job?.phase === 'queued' || job?.phase === 'running';
    const current = job?.current;
    const busy = sending || active;
    const running = !sending && job?.phase === 'running';
    const stage = job?.message.includes('合并摘要') ? 'merge' : 'compress';
    const label = sending ? '正在提交' : job?.phase === 'queued' ? '等待当前步骤结束' : job?.phase === 'running'
        ? stage === 'merge' ? '正在合并摘要' : '正在压缩' : '手动压缩';
    const progress = !sending && job?.phase === 'running' && Number.isInteger(job.completed) && Number.isInteger(job.total)
        && job.total > 1 && job.completed >= 0 && job.completed <= job.total ? `${job.completed}/${job.total}` : '';
    return _jsxs("div", { className: "dsh-cs-content", "data-phase": sending ? 'sending' : job?.phase ?? 'idle', children: [_jsxs("button", { className: "dsh-cs-button dsh-cs-primary dsh-cs-compact", type: "button", "aria-label": progress ? `${label} ${progress}` : label, disabled: sending || !state?.available || active, onClick: () => void act('configured'), children: [_jsxs("span", { className: "dsh-cs-button-status", "aria-hidden": "true", children: [running ? _jsx(WaitingCopy, { stage: stage }, stage) : _jsxs("span", { className: "dsh-cs-label", children: [label, busy ? '…' : ''] }), progress && _jsxs("span", { className: "dsh-cs-progress", children: [" ", progress] })] }), _jsxs("span", { className: "dsh-cs-sr-status", role: "status", "aria-live": "polite", "aria-atomic": "true", children: [label, progress ? ` ${progress}` : ''] })] }), !active && !sending && _jsx("div", { className: "dsh-cs-hint", children: "\u4E5F\u53EF\u4EE5\u957F\u6309\u5706\u73AF\u76F4\u63A5\u538B\u7F29" }), !busy && job?.message && _jsx("div", { className: "dsh-cs-status dsh-cs-job-status", role: "status", children: _jsxs("span", { children: [job.message, job.phase === 'done' && job.beforeTokens !== undefined && job.afterTokens !== undefined ? ` ${Math.round(job.beforeTokens / 1000)}K → ${Math.round(job.afterTokens / 1000)}K` : ''] }) }), state?.context?.corrected && _jsx("div", { className: "dsh-cs-status", children: state.context.reason === 'invalid-usage' ? '已排除异常历史用量，当前按消息和工具估算。' : '已按新模型的上下文容量重新估算。' }), error && _jsx("div", { className: "dsh-cs-error", role: "alert", children: error }), state && !state.config.model && !error && _jsx("div", { className: "dsh-cs-status", children: "\u5148\u5728\u8BBE\u7F6E \u2192 Compact Saviour \u4E2D\u9009\u62E9\u538B\u7F29\u6A21\u578B\u3002" }), state && !state.available && _jsx("div", { className: "dsh-cs-status", children: "\u5F53\u524D\u4F1A\u8BDD\u7684 Compact \u540E\u7AEF\u5C1A\u672A\u5C31\u7EEA\u3002" }), job?.phase === 'failed' && _jsxs("div", { className: "dsh-cs-actions", children: [_jsx("button", { className: "dsh-cs-button", disabled: sending, onClick: () => void act('configured'), children: "\u91CD\u8BD5\u538B\u7F29\u6A21\u578B" }), current && _jsxs("button", { className: "dsh-cs-button", disabled: sending, onClick: () => void act('current'), children: ["\u672C\u6B21\u4F7F\u7528 ", current.model, " \u00B7 ", current.reasoningEffort || '默认推理'] })] }), (active || job?.phase === 'failed') && _jsx("button", { className: "dsh-cs-button", disabled: sending, onClick: () => void act('cancel'), children: "\u53D6\u6D88" })] });
}
function SettingsPanel() {
    const [config, setConfig] = useState();
    const [models, setModels] = useState([]);
    const [search, setSearch] = useState('');
    const [efforts, setEfforts] = useState([]);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const abort = new AbortController();
        void Promise.all([api('', undefined, abort.signal), api('?models=1', undefined, abort.signal)])
            .then(([s, m]) => { setConfig(s.config); setModels(m.models); })
            .catch(e => { if (!abort.signal.aborted)
            setMessage(e.message); });
        return () => abort.abort();
    }, []);
    useEffect(() => {
        const abort = new AbortController();
        setEfforts([]);
        if (config?.provider && config.model)
            void api(`?provider=${encodeURIComponent(config.provider)}&model=${encodeURIComponent(config.model)}`, undefined, abort.signal)
                .then(v => setEfforts(v.efforts)).catch(e => { if (!abort.signal.aborted)
                setMessage(e.message); });
        return () => abort.abort();
    }, [config?.provider, config?.model]);
    const save = async () => {
        setSaving(true);
        setMessage('');
        try {
            const s = await api('', { action: 'settings', config });
            setConfig(s.config);
            setMessage('已保存。');
        }
        catch (e) {
            setMessage(e instanceof Error ? e.message : String(e));
        }
        finally {
            setSaving(false);
        }
    };
    const selected = config?.model ? JSON.stringify([config.provider, config.model]) : '';
    const filtered = models.filter(m => JSON.stringify([m.provider, m.id]) === selected || `${m.name} ${m.id} ${m.provider}`.toLowerCase().includes(search.toLowerCase()));
    return _jsxs("section", { className: "dsh-cs-settings", children: [_jsx("h2", { children: "Compact Saviour" }), _jsx("p", { children: "\u72EC\u7ACB\u6A21\u578B\u8D1F\u8D23\u4E0A\u4E0B\u6587\u538B\u7F29\u3002\u70B9\u51FB\u5706\u73AF\u67E5\u770B\u7528\u91CF\uFF0C\u957F\u6309\u5706\u73AF\u6216\u70B9\u51FB\u5F39\u5C42\u5185\u7684\u6309\u94AE\u5F00\u59CB\u538B\u7F29\u3002" }), config ? _jsxs(_Fragment, { children: [_jsxs("label", { className: "dsh-cs-toggle", children: [_jsx("input", { type: "checkbox", checked: config.enabled, onChange: e => setConfig({ ...config, enabled: e.target.checked }) }), " \u542F\u7528\u81EA\u52A8\u538B\u7F29\u8F85\u52A9"] }), _jsxs("label", { children: ["\u81EA\u52A8\u538B\u7F29\u65B9\u5F0F", _jsxs("select", { value: config.mode ?? 'rescue', disabled: !config.enabled, onChange: e => setConfig({ ...config, mode: e.target.value }), children: [_jsx("option", { value: "rescue", children: "\u5B98\u65B9\u8FDE\u7EED\u5931\u8D25\u4E24\u6B21\u540E\u6551\u63F4\uFF08\u9ED8\u8BA4\uFF09" }), _jsx("option", { value: "direct", children: "\u76F4\u63A5\u4F7F\u7528 Saviour \u6A21\u578B" })] })] }), _jsx("p", { children: !config.enabled ? '自动压缩由官方处理。手动压缩仍直接使用下方模型。' : config.mode === 'direct' ? '自动和手动压缩都直接使用下方模型。' : '自动压缩先由官方处理，连续失败两次后静默救援。手动压缩直接使用下方模型。' }), _jsxs("label", { children: ["Saviour \u538B\u7F29\u6A21\u578B", _jsx("input", { placeholder: "\u641C\u7D22\u5DF2\u914D\u7F6E\u7684\u6A21\u578B", value: search, onChange: e => setSearch(e.target.value) })] }), _jsxs("select", { "aria-label": "\u538B\u7F29\u6A21\u578B", value: selected, onChange: e => { const [provider, model] = e.target.value ? JSON.parse(e.target.value) : ['', '']; setConfig({ ...config, provider, model, reasoningEffort: '' }); }, children: [_jsx("option", { value: "", children: "\u8BF7\u9009\u62E9\u6A21\u578B" }), filtered.map(m => _jsxs("option", { value: JSON.stringify([m.provider, m.id]), children: [m.name, " \u00B7 ", m.provider] }, JSON.stringify([m.provider, m.id])))] }), _jsxs("label", { children: ["Reasoning level", _jsxs("select", { value: config.reasoningEffort, onChange: e => setConfig({ ...config, reasoningEffort: e.target.value }), children: [_jsx("option", { value: "", children: "\u6A21\u578B\u9ED8\u8BA4" }), efforts.map(e => _jsx("option", { value: e.id, children: e.name }, e.id))] })] }), _jsx("p", { children: "\u8D85\u957F\u5386\u53F2\u81EA\u52A8\u5206\u5757\uFF0C\u4FDD\u7559\u8FD1\u671F\u6D88\u606F\u548C\u539F\u59CB\u8BB0\u5F55\u3002\u5931\u8D25\u540E\u7531\u4F60\u9009\u62E9\u91CD\u8BD5\u3001\u4EC5\u672C\u6B21\u4F7F\u7528\u5F53\u524D\u5BF9\u8BDD\u6A21\u578B\uFF0C\u6216\u53D6\u6D88\u3002" }), _jsx("button", { className: "dsh-cs-button dsh-cs-primary", disabled: saving, onClick: () => void save(), children: saving ? '保存中…' : '保存' })] }) : _jsx("p", { children: "\u6B63\u5728\u52A0\u8F7D\u6A21\u578B\u914D\u7F6E\u2026" }), message && _jsx("p", { role: "status", children: message })] });
}
export function apply(ctx) {
    ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right', id: 'compact-saviour-popup-anchor', order: 100,
        inject: (sessionId) => ({ sessionId }),
    }, PopupBridge));
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section', id: 'compact-saviour', order: 38, label: () => 'Compact Saviour',
    }, SettingsPanel));
}
//# sourceMappingURL=index.js.map