import type { ContextView } from '../shared.js';
/** Narrow compatibility bridge until DSH exposes a context-meter reading slot.
 * Preserve the original React nodes, styles, handlers and any later owner update. */
export declare class MeterBridge {
    private edits;
    private write;
    private text;
    private attr;
    restore(): void;
    apply(ring: HTMLButtonElement | undefined, context?: ContextView): void;
}
//# sourceMappingURL=meter-bridge.d.ts.map