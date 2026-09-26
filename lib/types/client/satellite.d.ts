import motion from './vendor/open-bot-motion.cjs';
type Frame = ReturnType<typeof motion.getBot7State>;
export declare const orbitTime: (seconds: number) => number;
export declare function settleFrame(from: Frame, amount: number): Frame;
/** Owns one SVG and one clock. Hidden/reduced-motion pages consume no frames. */
export declare class Satellite {
    readonly svg: SVGElement;
    private projector;
    private body;
    private clipBody;
    private eyes;
    private dots;
    private frame?;
    private elapsed;
    private lastTime;
    private settling;
    private mode;
    private current;
    private exitFrom;
    private reduced;
    private disposed;
    private done?;
    constructor(host: HTMLElement);
    setRunning(running: boolean, done?: () => void): void;
    private wake;
    private finish;
    private tick;
    private render;
    destroy(): void;
}
export {};
//# sourceMappingURL=satellite.d.ts.map