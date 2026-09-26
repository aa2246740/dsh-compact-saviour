import { Satellite } from './satellite.js';

export const HOLD_MS = 650;
export type RingPhase = 'idle' | 'sending' | 'queued' | 'running' | 'done' | 'failed';
/** Enhance only the existing context button; native short click and keys survive. */
export class RingControl {
  private host = document.createElement('span');
  private bot: Satellite;
  private timer?: ReturnType<typeof setTimeout>;
  private pointer?: { id: number; x: number; y: number };
  private suppressedUntil = 0;
  private phase: RingPhase = 'idle';
  private available = false;
  private disposed = false;
  private previousTitle: string | null;
  private lastTitle = '';
  private native?: { element: SVGElement; fields: Map<string, { before: string; priority: string; last: string; lastPriority: string }> };
  constructor(readonly button: HTMLButtonElement, private activate: () => void) {
    this.previousTitle = button.getAttribute('title');
    this.host.className = 'dsh-cs-ring-art'; this.host.setAttribute('aria-hidden', 'true');
    this.host.innerHTML = '<svg class="dsh-cs-hold" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" pathLength="1"/></svg>';
    this.bot = new Satellite(this.host); button.append(this.host); button.classList.add('dsh-cs-ring');
    button.addEventListener('pointerdown', this.down);
    button.addEventListener('pointerleave', this.cancel);
    button.addEventListener('pointercancel', this.cancel);
    button.addEventListener('contextmenu', this.context);
    button.addEventListener('click', this.click, true);
    window.addEventListener('pointerup', this.up, true);
    window.addEventListener('pointermove', this.move, true);
    window.addEventListener('pointerdown', this.anotherPointer, true);
    window.addEventListener('blur', this.cancel);
    document.addEventListener('visibilitychange', this.cancel);
  }
  update(phase: RingPhase, available: boolean) {
    this.available = available;
    // Restore the native meter from job state, never from an animation callback.
    // React may also replace the trigger's class while updating its usage label.
    this.button.classList.add('dsh-cs-ring');
    if (this.host.parentElement !== this.button) this.button.append(this.host);
    if (this.button.dataset.csPhase !== phase) this.button.dataset.csPhase = phase;
    this.showMeter(!['sending', 'queued', 'running'].includes(phase));
    if (this.phase !== phase) {
      this.phase = phase;
      if (phase === 'running') { this.button.dataset.csMotion = 'running'; this.bot.setRunning(true); }
      else if (phase === 'queued' || phase === 'sending') { this.button.dataset.csMotion = 'queued'; this.bot.setRunning(false); }
      else {
        this.button.dataset.csMotion = 'settling';
        this.bot.setRunning(false, () => { if (!this.disposed) delete this.button.dataset.csMotion; });
      }
    }
    const title = phase === 'running' ? '正在压缩上下文 · 点击查看进度'
      : phase === 'queued' || phase === 'sending' ? '压缩已排队 · 点击查看进度'
      : '点击查看上下文 · 长按压缩';
    if (this.button.title !== title) this.button.title = title;
    this.lastTitle = title;
    if (!this.canHold()) this.cancel();
  }
  private restoreMeter() {
    if (!this.native) return;
    for (const [key, field] of this.native.fields) {
      if (this.native.element.style.getPropertyValue(key) !== field.last || this.native.element.style.getPropertyPriority(key) !== field.lastPriority) continue;
      if (field.before) this.native.element.style.setProperty(key, field.before, field.priority);
      else this.native.element.style.removeProperty(key);
    }
    this.native = undefined;
  }
  private showMeter(visible: boolean) {
    const element = this.button.querySelector<SVGElement>('svg[viewBox="0 0 14 14"]');
    if (this.native?.element !== element) {
      this.restoreMeter();
      if (element) this.native = { element, fields: new Map() };
    }
    if (!this.native) return;
    // The RC2 trigger includes percentage text. Keep the animation over the
    // actual icon instead of stretching it across the whole button.
    const iconBox = this.native.element.getBoundingClientRect(), buttonBox = this.button.getBoundingClientRect();
    const position = { left: `${iconBox.left - buttonBox.left - 3}px`, top: `${iconBox.top - buttonBox.top - 3}px`, width: `${iconBox.width + 6}px`, height: `${iconBox.height + 6}px` };
    for (const [key, value] of Object.entries(position)) if (this.host.style.getPropertyValue(key) !== value) this.host.style.setProperty(key, value);
    // Set the SVG itself: ancestor-attribute selector invalidation can leave an
    // SVG's computed visibility/opacity stale even when the job is already idle.
    for (const [key, value] of [['visibility', 'visible'], ['opacity', visible ? '1' : '0']] as const) {
      const style = this.native.element.style;
      let field = this.native.fields.get(key);
      if (!field || style.getPropertyValue(key) !== field.last || style.getPropertyPriority(key) !== field.lastPriority) {
        field = { before: style.getPropertyValue(key), priority: style.getPropertyPriority(key), last: value, lastPriority: '' };
        this.native.fields.set(key, field);
      }
      if (style.getPropertyValue(key) !== value) style.setProperty(key, value);
      field.last = value; field.lastPriority = style.getPropertyPriority(key);
    }
  }
  private canHold() { return this.available && !['sending', 'queued', 'running'].includes(this.phase); }
  private down = (event: PointerEvent) => {
    this.suppressedUntil = 0;
    if (!event.isPrimary || event.button !== 0 || !this.canHold()) return;
    this.cancel(); this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.button.dataset.csHolding = 'true';
    this.timer = setTimeout(() => {
      if (!this.pointer || !this.canHold() || !this.button.isConnected) { this.cancel(); return; }
      this.cancel(); this.suppressedUntil = Infinity;
      // Synthetic keyboard-style click is deliberately allowed; open the native
      // popup once so model/configuration errors always have a visible home.
      if (this.button.getAttribute('aria-expanded') !== 'true') this.button.click();
      this.activate();
    }, HOLD_MS);
  };
  private anotherPointer = (event: PointerEvent) => { if (this.pointer && this.pointer.id !== event.pointerId) this.cancel(); };
  private move = (event: PointerEvent) => { if (this.pointer?.id === event.pointerId && Math.hypot(event.clientX - this.pointer.x, event.clientY - this.pointer.y) > 10) this.cancel(); };
  private up = (event: PointerEvent) => {
    if (this.pointer?.id === event.pointerId) this.cancel();
    if (this.suppressedUntil === Infinity) this.suppressedUntil = performance.now() + 700;
  };
  private context = (event: Event) => { if (this.pointer || performance.now() < this.suppressedUntil) event.preventDefault(); };
  private click = (event: MouseEvent) => {
    if (event.detail !== 0 && performance.now() < this.suppressedUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  private cancel = () => {
    clearTimeout(this.timer); this.timer = undefined; this.pointer = undefined; delete this.button.dataset.csHolding;
  };
  destroy() {
    this.disposed = true; this.cancel(); this.bot.destroy(); this.host.remove();
    this.button.classList.remove('dsh-cs-ring'); delete this.button.dataset.csMotion; delete this.button.dataset.csPhase;
    this.restoreMeter();
    if (this.button.title === this.lastTitle) {
      if (this.previousTitle === null) this.button.removeAttribute('title'); else this.button.title = this.previousTitle;
    }
    this.button.removeEventListener('pointerdown', this.down); this.button.removeEventListener('pointerleave', this.cancel);
    this.button.removeEventListener('pointercancel', this.cancel); this.button.removeEventListener('contextmenu', this.context);
    this.button.removeEventListener('click', this.click, true);
    window.removeEventListener('pointerup', this.up, true); window.removeEventListener('pointermove', this.move, true);
    window.removeEventListener('pointerdown', this.anotherPointer, true); window.removeEventListener('blur', this.cancel);
    document.removeEventListener('visibilitychange', this.cancel);
  }
}
