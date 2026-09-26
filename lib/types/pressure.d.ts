import type { Context } from '@deepseek-ai/cordis';
import type { EpochHeader, Session } from '@deepseek-ai/dsh-session';
import type { TokenMeasurement } from '@deepseek-ai/dsh-token-meter';
import type { ContextView, Target } from './shared.js';
export declare function estimateRequest(measurement: TokenMeasurement, header?: EpochHeader): number;
/** Reject impossible historical anchors only; normal provider calibration remains authoritative. */
export declare function pressureEstimate(measurement: TokenMeasurement, capacity: number, header?: EpochHeader): number | undefined;
/** A reversible decoration of the public meter; no log or billing projection is rewritten. */
export declare class PressureMeter {
    private ctx;
    private capacities;
    private original;
    constructor(ctx: Context);
    private key;
    refresh(session: Session, target?: Target, signal?: AbortSignal): Promise<ContextView | undefined>;
}
//# sourceMappingURL=pressure.d.ts.map