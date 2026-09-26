import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Automated fixture only. Never connects to a user's browser or running Host.
const { launchPinnedChromium } = await import(pathToFileURL(`${homedir()}/.codex/playwright-runtime/runtime.mjs`).href);
const source = await readFile(new URL('../src/client/meter-bridge.ts', import.meta.url), 'utf8');
const elements = ts.transpileModule(await readFile(new URL('../src/client/context-elements.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const browser = await launchPinnedChromium();
try {
  const page = await browser.newPage();
  await page.setContent(`<main><span><button aria-label="上下文已用 100%" aria-haspopup="dialog" aria-expanded="true"><svg viewBox="0 0 14 14"><circle></circle><circle stroke-dasharray="34.55751918948772 34.55751918948772"></circle></svg></button><div role="dialog"><div><span>上下文已用</span><span>100%</span><span></span><span>~7.8M / 1M</span></div><div><div style="width:4.323308%"></div><div style="width:64.097744%"></div><div style="width:31.578948%"></div></div><dl><div><dt>系统提示词</dt><dd>~2.3K</dd></div><div><dt>工具定义</dt><dd>~34.1K</dd></div><div><dt>对话消息</dt><dd>~16.8K</dd></div></dl><div data-compact-saviour><button>手动压缩</button></div></div></span></main>`);
  await page.addScriptTag({ content: `(()=>{const exports={};const require=()=>{const exports={};${elements};return exports;};${compiled};window.MeterBridge=exports.MeterBridge;})()` });
  const proof = await page.evaluate(async () => {
    const bridge = new window.MeterBridge(), ring = document.querySelector('button[aria-haspopup]');
    const header = document.querySelector('[role=dialog]').firstElementChild;
    const snapshot = () => ({ text: document.querySelector('main').textContent, aria: ring.getAttribute('aria-label'),
      circle: ring.querySelectorAll('circle')[1].getAttribute('stroke-dasharray'), widths: [...header.nextElementSibling.children].map(e => e.style.width) });
    const before = snapshot();
    const textNode = header.children[1].firstChild;
    const context = { corrected: true, reason: 'invalid-usage', usedTokens: 53_200, reportedTokens: 7_800_000, contextWindow: 1_000_000, parts: [2300, 34100, 16800] };
    let mutations = 0;
    const observer = new MutationObserver(() => { mutations++; if (mutations < 100) bridge.apply(ring, context); });
    observer.observe(document.querySelector('main'), { subtree: true, attributes: true, characterData: true, childList: true });
    bridge.apply(ring, context);
    await new Promise(resolve => setTimeout(resolve, 25));
    observer.disconnect();
    const corrected = { reading: header.children[1].textContent, figures: header.children[3].textContent,
      aria: ring.getAttribute('aria-label'), sameTextNode: textNode === header.children[1].firstChild,
      barWidth: [...header.nextElementSibling.children].reduce((n, e) => n + parseFloat(e.style.width), 0),
      circle: parseFloat(ring.querySelectorAll('circle')[1].getAttribute('stroke-dasharray')),
      buttons: document.querySelectorAll('[data-compact-saviour] button').length, mutations };
    bridge.restore();
    // CSSOM may canonicalize whitespace in style attributes; compare owned values.
    const restored = JSON.stringify(snapshot()) === JSON.stringify(before);
    bridge.apply(ring, context);
    header.children[1].firstChild.nodeValue = '40%';
    header.children[3].firstChild.nodeValue = '~400K / 1M';
    ring.setAttribute('aria-label', '上下文已用 40%');
    bridge.apply(ring, context);
    bridge.apply(ring, { ...context, corrected: false });
    return { corrected, restored, laterOwnerReading: header.children[1].textContent, laterOwnerFigures: header.children[3].textContent, laterOwnerAria: ring.getAttribute('aria-label') };
  });
  assert.equal(proof.corrected.reading, '5%'); assert.equal(proof.corrected.figures, '~53.2K / 1M');
  assert.equal(proof.corrected.aria, '上下文已用 5%'); assert.ok(proof.corrected.sameTextNode);
  assert.ok(Math.abs(proof.corrected.barWidth - 5) < .00001);
  assert.ok(Math.abs(proof.corrected.circle - 2 * Math.PI * 5.5 * .05) < .000001);
  assert.equal(proof.corrected.buttons, 1); assert.ok(proof.corrected.mutations < 5, 'observer must settle');
  assert.ok(proof.restored); assert.equal(proof.laterOwnerReading, '40%'); assert.equal(proof.laterOwnerFigures, '~400K / 1M'); assert.equal(proof.laterOwnerAria, '上下文已用 40%');
  console.log(JSON.stringify(proof, null, 2));
  const portalProof = await page.evaluate(() => {
    const bridge = new window.MeterBridge(), ring = document.querySelector('button[aria-haspopup]');
    const panel = document.querySelector('[role=dialog]');
    document.body.append(panel);
    const label = document.createElement('span'); label.textContent = '40%'; ring.append(label);
    panel.querySelector('dl').remove();
    const header = panel.firstElementChild;
    const context = { corrected: true, usedTokens: 53_200, reportedTokens: 7_800_000, contextWindow: 1_000_000, parts: [2300, 34100, 16800] };
    bridge.apply(ring, context);
    const corrected = [label.textContent, header.children[1].textContent, header.children[3].textContent];
    bridge.restore();
    const restored = [label.textContent, header.children[1].textContent];
    // Two simultaneous composers without an explicit aria-controls are
    // ambiguous: the bridge must not write into either one's body portal.
    const other = ring.cloneNode(true); document.body.append(other);
    bridge.apply(ring, context);
    const ambiguousPanel = header.children[1].textContent;
    bridge.restore(); other.remove();
    ring.setAttribute('aria-expanded', 'false');
    bridge.apply(ring, context);
    const closedPanel = header.children[1].textContent;
    bridge.restore();
    return { corrected, restored, ambiguousPanel, closedPanel };
  });
  assert.deepEqual(portalProof.corrected, ['5%', '5%', '~53.2K / 1M']);
  assert.deepEqual(portalProof.restored, ['40%', '40%']);
  assert.equal(portalProof.ambiguousPanel, '40%');
  assert.equal(portalProof.closedPanel, '40%');
  console.log(JSON.stringify({ portalProof }, null, 2));
} finally { await browser.close(); }
