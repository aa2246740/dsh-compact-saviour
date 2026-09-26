import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync, createPortal } from 'react-dom';
import { PopupBridge } from '../src/client/index.js';
import { Satellite } from '../src/client/satellite.js';
const fixture = window as any;
fixture.requests = [];
fixture.session = 'fixture-A';
fixture.result = 'running';
fixture.job = { phase: 'idle', message: '', failures: 0 };
fixture.apiError = false;
fixture.bridgeVisible = true;
fixture.fetch = async (_url: string, options?: RequestInit) => {
  if (options?.method === 'POST') {
    const body = JSON.parse(String(options.body)); fixture.requests.push(body);
    if (fixture.apiError) return new Response(JSON.stringify({ error: '请选择压缩模型。' }), { status: 400 });
    fixture.job = { phase: body.action === 'cancel' ? 'idle' : fixture.result, message: body.action === 'cancel' ? '已取消' : '正在压缩上下文…', failures: 0 };
  }
  return new Response(JSON.stringify({ config: { enabled: true, mode: 'direct', provider: 'mock', model: 'fast', reasoningEffort: '' }, available: true, job: fixture.job }));
};
fixture.layout = 'portal';
fixture.hasBreakdown = true;
fixture.showRing = true;
function Fixture() {
  const [open, setOpen] = useState(false);
  const panel = <div role="dialog" aria-label="上下文已用"><div className="header"><span>上下文已用</span><span>48%</span><span></span><span>~508K / 1M</span></div><div className="bar"><div/></div>{fixture.hasBreakdown && <dl><div><dt>系统提示词</dt><dd>~2.3K</dd></div><div><dt>工具定义</dt><dd>~34.1K</dd></div><div><dt>对话消息</dt><dd>~372K</dd></div></dl>}</div>;
  const ring = fixture.showRing && <span><button id="ring" aria-label="上下文已用 48%" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}><svg viewBox="0 0 14 14" width="14" height="14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="#e3e5e8" strokeWidth="2"/><circle cx="7" cy="7" r="5.5" fill="none" stroke="#9097a2" strokeWidth="2" strokeDasharray="16 35"/></svg>{fixture.layout === 'portal' && <span>48%</span>}</button>{open && (fixture.layout === 'portal' ? createPortal(panel, document.body) : panel)}</span>;
  const controls = <><span data-slot="conversation.input.right">{fixture.bridgeVisible && <PopupBridge sessionId={fixture.session}/>}</span><button className="send" aria-label="发送">↑</button></>;
  // RC2 moved ContextMeter outside data-composer-card and portals its panel to
  // document.body; keep this fixture faithful to both independent changes.
  return <div className="composer">{fixture.layout === 'portal' ? <><div data-composer-card><div><div>{controls}</div></div></div><div className="dock">{ring}</div></> : <>{ring}{controls}</>}</div>;

}
const root = createRoot(document.getElementById('root')!);
fixture.render = () => flushSync(() => root.render(<Fixture/>));
fixture.unmount = () => flushSync(() => root.render(null));
fixture.Satellite = Satellite;
fixture.render();
