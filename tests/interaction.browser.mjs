import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.resolve('tsdown'));
const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href);
const bundle = await rolldown({ input: fileURLToPath(new URL('./interaction-fixture.tsx', import.meta.url)),
  transform: { define: { 'process.env.NODE_ENV': '"production"' } }, plugins: [{ name: 'fixture-typescript', async load(id) {
    if (id.endsWith('.css')) return { code: '', moduleType: 'js' };
    if (/\.tsx?$/.test(id)) return ts.transpileModule(await readFile(id, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  } }] });
const output = await bundle.generate({ format: 'iife' }); await bundle.close();
const script = output.output.find(o => o.type === 'chunk').code;
const { launchPinnedChromium } = await import(pathToFileURL(`${homedir()}/.codex/playwright-runtime/runtime.mjs`).href);
const browser = await launchPinnedChromium();
const proofDir = process.env.COMPACT_PROOF_DIR ?? fileURLToPath(new URL('../.proof/interaction/', import.meta.url)); await mkdir(proofDir, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 600, height: 420 }, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => { errors.push(String(e)); console.error(String(e)); });
  await page.clock.install();
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ content: `${await readFile(new URL('../src/client/style.css', import.meta.url), 'utf8')}
    body{margin:0;background:#fafafa;font:14px -apple-system,sans-serif;color:#535963}.composer{position:absolute;bottom:32px;right:64px;display:flex;align-items:center;gap:12px}.composer>span:first-child{position:relative;display:inline-flex}#ring{min-width:28px;height:28px;display:flex;align-items:center;gap:4px;border:0;border-radius:50%;background:transparent}#ring:hover{background:#eceef1}[role=dialog]{position:fixed;bottom:80px;right:64px;width:264px;padding:12px;box-sizing:border-box;border-radius:16px;background:white;box-shadow:0 4px 24px #0001}.header{display:flex;gap:8px;align-items:center;font-size:12px}.header>span:last-child{margin-left:auto;color:#121821}.bar{height:4px;border-radius:4px;background:#eee;margin:12px 0}.bar>div{width:48%;height:4px;background:#498af7;border-radius:4px}dl{font-size:12px}dl>div{display:flex;justify-content:space-between;margin:10px 0}dd{margin:0}.send{border:0;border-radius:50%;width:34px;height:34px;background:#447ef0;color:white;font-size:22px}
  ` });
  await page.addScriptTag({ content: script });
  if (process.env.COMPACT_LAYOUT === 'legacy') await page.evaluate(() => { layout = 'legacy'; render(); });
  await page.clock.runFor(100); await page.locator('#ring').waitFor({ timeout: 3000 });
  const ring = page.locator('#ring');
  const visibleMeter = async () => {
    // CSS compositor transitions run independently from the mocked JS clock.
    await page.waitForFunction(() => {
      const el = document.querySelector('#ring > svg[viewBox="0 0 14 14"]');
      return el && getComputedStyle(el).opacity === '1';
    }, undefined, { timeout: 3000 });
    const value = await ring.locator(':scope > svg[viewBox="0 0 14 14"]').evaluate(el => {
      const style = getComputedStyle(el), box = el.getBoundingClientRect();
      return { visibility: style.visibility, opacity: Number(style.opacity), width: box.width, height: box.height,
        strokes: [...el.querySelectorAll('circle')].map(c => getComputedStyle(c).stroke) };
    });
    assert.equal(value.visibility, 'visible'); assert.equal(value.opacity, 1);
    assert.equal(value.width, 14); assert.equal(value.height, 14);
    assert.ok(value.strokes.every(stroke => stroke !== 'none' && stroke !== 'transparent'));
  };
  // A rescue arriving through polling never opens a popup, steals focus, or
  // requires a manual POST. Its state is available only when the user opens it.
  await page.locator('.send').focus();
  for (const phase of ['running', 'done', 'failed', 'idle']) {
    await page.evaluate(phase => { job = { phase, message: phase, failures: 2 }; }, phase);
    await page.clock.runFor(1500);
    assert.equal(await page.locator('[role=dialog]').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.className), 'send');
    assert.equal(await page.evaluate(() => requests.length), 0);
  }
  await ring.click(); assert.equal(await page.getByRole('button', { name: '手动压缩', exact: true }).count(), 1);
  assert.equal(await page.locator('[data-compact-saviour]').count(), 1);
  // Missing contextBreakdown is supported by the native meter; manual rescue
  // must still be reachable before that optional projection arrives.
  await page.evaluate(() => { hasBreakdown = false; render(); });
  assert.equal(await page.getByRole('button', { name: '手动压缩', exact: true }).count(), 1);
  await page.evaluate(() => { hasBreakdown = true; render(); });
  assert.equal(await page.locator('[role=dialog] > :last-child').getAttribute('data-compact-saviour'), 'footer');
  const geometry = await ring.evaluate(el => {
    const icon = el.querySelector('svg[viewBox="0 0 14 14"]').getBoundingClientRect();
    const art = el.querySelector('.dsh-cs-ring-art').getBoundingClientRect();
    return { dx: (art.left + art.right - icon.left - icon.right) / 2, dy: (art.top + art.bottom - icon.top - icon.bottom) / 2, width: art.width, height: art.height };
  });
  assert.ok(Math.abs(geometry.dx) < .1 && Math.abs(geometry.dy) < .1, JSON.stringify(geometry));
  assert.equal(geometry.width, 20); assert.equal(geometry.height, 20);
  await page.screenshot({ path: `${proofDir}/manual-popup.png` });
  await ring.click(); assert.equal(await page.locator('[role=dialog]').count(), 0);
  await ring.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: '手动压缩', exact: true }).count(), 1);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => requests.length), 0, 'keyboard activation only opens the popup');
  const center = async () => { const b = await ring.boundingBox(); return { x: b.x+b.width/2, y: b.y+b.height/2 }; };
  let pos = await center(); await page.mouse.move(pos.x,pos.y); await page.mouse.down(); await page.clock.runFor(300); await page.mouse.up();
  assert.equal(await page.evaluate(() => requests.length), 0, 'short hold does not compact');
  await ring.click(); // close short-click popup
  await page.mouse.down(); await page.clock.runFor(200); await page.mouse.move(pos.x-50,pos.y); await page.clock.runFor(650); await page.mouse.up();
  assert.equal(await page.evaluate(() => requests.length), 0, 'moving away cancels');
  await page.mouse.move(pos.x,pos.y); await page.mouse.down(); await page.clock.runFor(700); await page.clock.runFor(50);
  assert.equal(await page.evaluate(() => requests.length), 1);
  assert.equal(await ring.getAttribute('data-cs-motion'), 'running');
  await page.clock.runFor(3200); await page.mouse.up();
  assert.equal(await page.locator('[role=dialog]').count(), 1, 'release after a very long hold must not close popup');
  assert.equal(await page.evaluate(() => requests.length), 1, 'holding continues to send only one request');
  const a = await page.locator('.dsh-cs-body').getAttribute('d');
  await page.clock.runFor(500); const b = await page.locator('.dsh-cs-body').getAttribute('d'); assert.notEqual(a,b);
  assert.equal(await page.locator('.dsh-cs-dot').count(), 8);
  // One call needs no subtitle or artificial chunk counter. Multi-call progress
  // and merging stay in the button; backend totals include the merge work.
  const setJob = async patch => {
    await page.evaluate(patch => { job = { phase: 'running', failures: 0, ...patch }; }, patch);
    await page.clock.runFor(1500);
  };
  await setJob({ message: '上下文可一次容纳，正在整段压缩…', completed: 0, total: 1 });
  assert.equal(await page.getByRole('button', { name: '正在压缩', exact: true }).count(), 1);
  assert.equal(await page.locator('.dsh-cs-progress, .dsh-cs-job-status').count(), 0);
  assert.equal(await page.getByText('上下文可一次容纳', { exact: false }).count(), 0);
  const copy = page.locator('.dsh-cs-waiting-copy > [data-active="true"]');
  const initialCopy = await copy.textContent();
  await page.clock.runFor(6100);
  assert.notEqual(await copy.textContent(), initialCopy, 'copy rotates despite 1s job polling');
  assert.equal(await page.getByRole('button', { name: '正在压缩', exact: true }).count(), 1, 'decorative copy is not announced as a new processing stage');
  assert.equal(await page.locator('.dsh-cs-sr-status').textContent(), '正在压缩');
  assert.equal(await page.locator('.dsh-cs-ellipsis').count(), 0, 'no jumping dots');
  assert.ok(await page.locator('.dsh-cs-waiting-copy > span').evaluateAll(els => els.every(el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transform === 'none')));
  assert.equal(await copy.evaluate(el => getComputedStyle(el).transitionProperty), 'opacity');
  await setJob({ message: '按压缩模型容量自动分为 4 块，正在压缩… 2/5', completed: 2, total: 5 });
  assert.equal(await page.getByRole('button', { name: '正在压缩 2/5', exact: true }).count(), 1);
  assert.equal(await page.locator('.dsh-cs-job-status').count(), 0);
  const beforeCopy = await copy.textContent();
  const beforeProgress = await page.locator('.dsh-cs-progress').boundingBox();
  const beforeButton = await page.locator('.dsh-cs-compact').boundingBox();
  await page.clock.runFor(6000);
  assert.notEqual(await copy.textContent(), beforeCopy);
  assert.deepEqual(await page.locator('.dsh-cs-progress').boundingBox(), beforeProgress, 'counter does not jump with wording changes');
  assert.deepEqual(await page.locator('.dsh-cs-compact').boundingBox(), beforeButton);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  const hiddenCopy = await copy.textContent();
  await page.clock.runFor(12000);
  assert.equal(await copy.textContent(), hiddenCopy, 'background page pauses copy rotation');
  await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.locator('.dsh-cs-compact').evaluate(el => getComputedStyle(el, '::before').animationName), 'dsh-cs-shimmer');
  const shimmerFrames = await page.locator('.dsh-cs-compact').evaluate(el => {
    // Sample the actual CSS animation away from its intentional resting interval.
    const animation = el.getAnimations({ subtree: true }).find(a => a.animationName === 'dsh-cs-shimmer');
    animation.pause(); animation.currentTime = 200;
    const first = getComputedStyle(el, '::before').transform;
    animation.currentTime = 1100;
    const second = getComputedStyle(el, '::before').transform;
    animation.play(); return [first, second];
  });
  assert.notEqual(...shimmerFrames);
  await page.screenshot({ path: `${proofDir}/running-light.png` });
  await page.addStyleTag({ content: 'body{background:#1b1d22;color:#bec2ca;--dsw-alias-label-primary:#eef1f8;--dsw-alias-label-secondary:#b2b6c1;--dsw-alias-label-tertiary:#989fad;--dsw-alias-separator:#383b43;--dsw-alias-interactive-bg-hover:#30333b;--dsw-static-blue-550:#82a9ff}[role=dialog]{background:#252830}#ring:hover{background:#30333b}.header>span:last-child{color:#eef1f8}.bar{background:#383b43}' });
  await page.screenshot({ path: `${proofDir}/running-dark.png` });
  await setJob({ message: '模型实际上下文受限，正在缩小超限分块… 2/7', completed: 2, total: 7 });
  assert.equal(await page.getByRole('button', { name: '正在压缩 2/7', exact: true }).count(), 1);
  await setJob({ message: '正在合并摘要，保留待办和关键细节… 6/7', completed: 6, total: 7 });
  assert.equal(await page.getByRole('button', { name: '正在合并摘要 6/7', exact: true }).count(), 1);
  assert.equal(await copy.textContent(), '正在合并摘要…', 'actual stage change resets the copy');
  assert.equal(await page.locator('.dsh-cs-job-status').count(), 0);
  await page.screenshot({ path: `${proofDir}/merging-dark.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.runFor(1000);
  await page.waitForFunction(() => [...document.querySelectorAll('.dsh-cs-dot')].every(dot => dot.getAttribute('r') === '0'));
  const still = await page.locator('.dsh-cs-body').getAttribute('d'); await page.clock.runFor(1000);
  assert.equal(await page.locator('.dsh-cs-body').getAttribute('d'), still, 'reduced motion freezes');
  assert.equal(await page.locator('.dsh-cs-compact').evaluate(el => getComputedStyle(el, '::before').animationName), 'none');
  await page.clock.runFor(7000);
  assert.equal(await copy.textContent(), '正在合并摘要…');
  assert.equal(await copy.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button',{name:'取消',exact:true}).click(); await page.clock.runFor(500);
  assert.equal(await ring.getAttribute('data-cs-motion'), null, 'cancel restores occupancy ring');
  await visibleMeter();
  assert.equal(await page.evaluate(() => requests.length), 2);
  // Queue shows a resting bot; running starts orbit; all terminal outcomes restore the ring.
  for (const phase of ['queued','running','done','running','failed']) {
    await page.evaluate(phase => { job={phase,message:phase,failures:0}; }, phase); await page.clock.runFor(1500);
    assert.equal(await ring.getAttribute('data-cs-motion'), ['queued','running'].includes(phase) ? phase : null);
    if (['done', 'failed'].includes(phase)) await visibleMeter();
    assert.equal(await page.locator('.dsh-cs-job-status').count(), ['done', 'failed'].includes(phase) ? 1 : 0);
  }
  // Drop the animation's exit callback. Job completion must still restore the
  // *rendered* ring, not just a bookkeeping attribute (the former test gap).
  await page.evaluate(() => {
    window.savedSetRunning = Satellite.prototype.setRunning;
    Satellite.prototype.setRunning = function(running, done) { savedSetRunning.call(this, running); };
    job = { phase: 'running', message: '正在压缩…', failures: 0 };
  });
  await page.clock.runFor(1500);
  await page.evaluate(() => { job = { phase: 'done', message: '压缩完成（按当前消息和工具估算）。', beforeTokens: 472000, afterTokens: 50000, failures: 0 }; });
  await page.clock.runFor(1500);
  assert.equal(await ring.getAttribute('data-cs-motion'), 'settling', 'callback deliberately did not run');
  await visibleMeter();
  assert.match(await page.locator('.dsh-cs-job-status').textContent(), /472K → 50K/);
  assert.equal(await page.locator('.dsh-cs-robot').evaluate(el => getComputedStyle(el).opacity), '0');
  assert.equal(await page.locator('.dsh-cs-compact').evaluate(el => getComputedStyle(el, '::before').animationIterationCount), '1');
  await page.screenshot({ path: `${proofDir}/completed-restored.png` });
  await page.evaluate(() => { Satellite.prototype.setRunning = savedSetRunning; });
  await page.evaluate(() => { apiError=true; });
  await page.getByRole('button',{name:'手动压缩',exact:true}).click(); await page.clock.runFor(1500);
  assert.equal(await page.getByRole('alert').textContent(), '请选择压缩模型。', 'polling must not erase actionable errors');
  const count = await page.evaluate(() => requests.length);
  await page.mouse.move(pos.x,pos.y); await page.mouse.down(); await page.clock.runFor(200);
  await page.evaluate(() => { session='fixture-B'; render(); }); await page.clock.runFor(800); await page.mouse.up();
  assert.equal(await page.evaluate(() => requests.length), count, 'session change cancels pending hold');
  assert.equal(await page.locator('.dsh-cs-ring-art').count(),1, 'no duplicate icon after session change');
  await page.evaluate(() => { bridgeVisible=false; render(); }); await page.clock.runFor(100);
  assert.equal(await ring.locator(':scope > svg').evaluate(el => el.style.opacity), '', 'unmount restores original SVG opacity');
  assert.equal(await ring.locator(':scope > svg').evaluate(el => el.style.visibility), '', 'unmount restores original SVG visibility');
  assert.equal(await ring.getAttribute('data-cs-phase'), null);
  await page.evaluate(() => unmount()); await page.clock.runFor(2000);
  assert.equal(await page.locator('.dsh-cs-ring-art').count(),0);
  assert.deepEqual(errors, []);
  const proof = { layout: process.env.COMPACT_LAYOUT ?? 'portal', optionalBreakdown:true, iconAligned:true, shortClick:true, keyboardAccess:true, cancelledHold:true, dragCancel:true, singleLongPress:true, longRelease:true, orbit:true, backgroundShimmer:true, rotatingWaitingCopy:true, noJumpingText:true, stableProgressPosition:true, backgroundPause:true, stableAccessibleStatus:true, silentAutomaticJob:true, inlineAdaptiveProgress:true, noRunningSubtitle:true, mergingLabel:true, reducedMotion:true, terminalStates:true, renderedMeterRestored:true, droppedExitCallbackSafe:true, persistentErrors:true, sessionCleanup:true, consoleErrors:errors };
  await writeFile(`${proofDir}/proof.json`, JSON.stringify(proof,null,2)); console.log(JSON.stringify(proof,null,2));
} finally { await browser.close(); }
