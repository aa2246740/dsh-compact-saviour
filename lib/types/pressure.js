export function estimateRequest(measurement, header) {
    return measurement.surfaceTokens + (header?.tools?.length ? Math.ceil(JSON.stringify(header.tools).length / 4) + 4 : 0);
}
/** Reject impossible historical anchors only; normal provider calibration remains authoritative. */
export function pressureEstimate(measurement, capacity, header) {
    const estimate = estimateRequest(measurement, header);
    return measurement.baseline.kind === 'usage' && measurement.baseline.tokens > capacity * 1.1
        && estimate < capacity * .75 ? estimate : undefined;
}
/** A reversible decoration of the public meter; no log or billing projection is rewritten. */
export class PressureMeter {
    ctx;
    capacities = new Map();
    original;
    constructor(ctx) {
        this.ctx = ctx;
        const meter = ctx.tokenMeter, own = Object.getOwnPropertyDescriptor(meter, 'measure');
        this.original = meter.measure;
        const self = this;
        const measure = function (session, requestHeader) {
            const value = self.original.call(this, session, requestHeader);
            const header = requestHeader ?? session.requestHeader();
            const cached = header && self.capacities.get(self.key(header.config));
            const estimate = cached && cached.expires > Date.now() ? pressureEstimate(value, cached.capacity, header) : undefined;
            return estimate === undefined ? value : Object.freeze({ ...value,
                baseline: Object.freeze({ kind: 'estimated', tokens: estimate }), surfaceDeltaTokens: 0, totalTokens: estimate, });
        };
        ctx.effect(() => {
            meter.measure = measure;
            return () => {
                if (Object.getOwnPropertyDescriptor(meter, 'measure')?.value !== measure)
                    return;
                if (own)
                    Object.defineProperty(meter, 'measure', own);
                else
                    Reflect.deleteProperty(meter, 'measure');
            };
        });
    }
    key(target) { return JSON.stringify([target.provider, target.model]); }
    async refresh(session, target, signal) {
        const logged = session.requestHeader();
        target ??= logged?.config;
        if (!target?.provider || !target.model)
            return;
        const key = this.key(target);
        let cached = this.capacities.get(key);
        if (!cached || cached.expires <= Date.now()) {
            const info = await this.ctx.llm.resolveModelInfo(target.provider, target.model, signal);
            const capacity = info.context?.contextWindow;
            if (!capacity || !Number.isFinite(capacity) || capacity <= 0)
                return;
            cached = { capacity, expires: Date.now() + 60_000 };
            if (this.capacities.size >= 64)
                this.capacities.delete(this.capacities.keys().next().value);
            this.capacities.set(key, cached);
        }
        const header = logged && { ...logged, config: { ...logged.config, provider: target.provider, model: target.model } };
        const raw = this.original.call(this.ctx.tokenMeter, session, header);
        const estimate = pressureEstimate(raw, cached.capacity, header);
        const switched = logged && this.key(logged.config) !== key;
        const breakdown = this.ctx.sessionProjections.stateOf(session, 'contextBreakdown')?.breakdown;
        return {
            usedTokens: estimate ?? raw.totalTokens, reportedTokens: raw.totalTokens, contextWindow: cached.capacity,
            corrected: estimate !== undefined || !!switched,
            ...(estimate !== undefined ? { reason: 'invalid-usage' } : switched ? { reason: 'model-switch' } : {}),
            ...(breakdown ? { parts: [breakdown.systemTokens, breakdown.toolsTokens, breakdown.messageTokens] } : {}),
        };
    }
}
//# sourceMappingURL=pressure.js.map