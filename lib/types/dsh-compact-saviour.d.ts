import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { Config as Settings } from './shared.js';
export declare const name = "dsh-compact-saviour";
export declare const inject: string[];
export declare const Config: z;
export declare function apply(ctx: Context, config: {
    [K in keyof Settings]-?: Volatile<Settings[K]>;
}): void;
//# sourceMappingURL=dsh-compact-saviour.d.ts.map