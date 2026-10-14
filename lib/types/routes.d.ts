import type { Agent } from '@deepseek-ai/dsh-agent';
import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
import type { Target } from './shared.js';
/** Optional plugin contract. Capacity is resolved separately for these exact routes. */
export interface CompactionRouteSnapshot {
    revision: string;
    context: Target;
    target: Target;
    maxOutputTokens?: number;
}
export interface CompactionRouteLease extends CompactionRouteSnapshot {
    readonly signal: AbortSignal;
    assertCurrent(): void;
    prepare(request: GenerateOptions): GenerateOptions;
}
type Resolver = (agent: Agent) => CompactionRouteSnapshot | undefined;
/** Fiber-owned registrations; a lease expires on route change or owner unload. */
export declare class CompactionRouteRegistry {
    readonly apiVersion = 1;
    private resolvers;
    register(owner: string, resolve: Resolver): () => void;
    resolve(agent: Agent): CompactionRouteLease | undefined;
    close(): void;
}
export {};
//# sourceMappingURL=routes.d.ts.map