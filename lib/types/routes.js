function snapshot(value) {
    if (!value.revision || ![value.context, value.target].every(route => typeof route?.provider === 'string' && route.provider && typeof route.model === 'string' && route.model
        && (route.reasoningEffort === undefined || typeof route.reasoningEffort === 'string' && route.reasoningEffort)))
        throw new Error('Invalid session compaction route');
    if (value.maxOutputTokens !== undefined && (!Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens <= 0))
        throw new Error('Invalid session compaction output reservation');
    return Object.freeze({ revision: value.revision,
        context: Object.freeze({ ...value.context }), target: Object.freeze({ ...value.target }),
        ...(value.maxOutputTokens === undefined ? {} : { maxOutputTokens: value.maxOutputTokens }) });
}
const key = (value) => JSON.stringify([value.revision,
    value.context.provider, value.context.model, value.context.reasoningEffort,
    value.target.provider, value.target.model, value.target.reasoningEffort, value.maxOutputTokens]);
/** Fiber-owned registrations; a lease expires on route change or owner unload. */
export class CompactionRouteRegistry {
    apiVersion = 1;
    resolvers = new Set();
    register(owner, resolve) {
        if (!owner)
            throw new Error('Compaction route owner is required');
        const entry = { owner, resolve, lifecycle: new AbortController() };
        this.resolvers.add(entry);
        return () => { this.resolvers.delete(entry); entry.lifecycle.abort(new Error('Session compaction route owner unloaded')); };
    }
    resolve(agent) {
        const matches = [...this.resolvers].flatMap(entry => {
            const value = entry.resolve(agent);
            return value ? [{ entry, value: snapshot(value) }] : [];
        });
        if (!matches.length)
            return undefined;
        if (matches.length !== 1)
            throw new Error('Multiple plugins own this session compaction route');
        const { entry, value } = matches[0];
        const signature = key(value);
        const assertCurrent = () => {
            if ([...this.resolvers].some(other => other !== entry && other.resolve(agent)))
                throw new Error('Multiple plugins own this session compaction route');
            const current = this.resolvers.has(entry) && entry.resolve(agent);
            if (!current || key(snapshot(current)) !== signature)
                throw new Error('Session compaction route changed; retry with the current model');
        };
        return Object.freeze({ ...value, signal: entry.lifecycle.signal, assertCurrent,
            prepare: (request) => {
                request.signal?.throwIfAborted();
                assertCurrent();
                if (request.purpose !== 'compaction' || request.sessionId !== agent.session.id
                    || request.provider !== value.target.provider || request.model !== value.target.model
                    || request.reasoningEffort !== value.target.reasoningEffort
                    || !Number.isSafeInteger(request.maxTokens) || Number(request.maxTokens) <= 0
                    || value.maxOutputTokens !== undefined && request.maxTokens > value.maxOutputTokens)
                    throw new Error('Compaction request does not match its planned physical route');
                // Host llm.stream supports frozen one-shot envelopes. Later middleware
                // may validate this route, but cannot replace its model or reservation.
                return Object.freeze(request);
            },
        });
    }
    close() {
        for (const entry of this.resolvers)
            entry.lifecycle.abort(new Error('Session compaction route registry unloaded'));
        this.resolvers.clear();
    }
}
//# sourceMappingURL=routes.js.map