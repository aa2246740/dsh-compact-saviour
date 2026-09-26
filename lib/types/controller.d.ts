import { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
interface SettingsScope<T> {
    get(): T;
    replace(value: T): Promise<void>;
}
import type { Config, Target, State } from './shared.js';
export declare class Controller {
    readonly ctx: Context;
    readonly settings: SettingsScope<Config>;
    private bindings;
    private jobs;
    private disposed;
    private pressure;
    constructor(ctx: Context, settings: SettingsScope<Config>);
    private job;
    private scan;
    private binding;
    private configured;
    private direct;
    current(agent: Agent): Target | undefined;
    state(id?: string): State;
    context(id?: string): Promise<import("./shared.js").ContextView | undefined>;
    request(id: string, mode: 'configured' | 'current' | 'cancel'): State;
    private runIdle;
    private runPending;
    private fail;
    private rescue;
}
export {};
//# sourceMappingURL=controller.d.ts.map