export declare const HOLD_MS = 650;
export type RingPhase = 'idle' | 'sending' | 'queued' | 'running' | 'done' | 'failed';
/** Enhance only the existing context button; native short click and keys survive. */
export declare class RingControl {
    readonly button: HTMLButtonElement;
    private activate;
    private host;
    private bot;
    private timer?;
    private pointer?;
    private suppressedUntil;
    private phase;
    private available;
    private disposed;
    private previousTitle;
    private lastTitle;
    private native?;
    constructor(button: HTMLButtonElement, activate: () => void);
    update(phase: RingPhase, available: boolean): void;
    private restoreMeter;
    private showMeter;
    private canHold;
    private down;
    private anotherPointer;
    private move;
    private up;
    private context;
    private click;
    private cancel;
    destroy(): void;
}
//# sourceMappingURL=ring-control.d.ts.map