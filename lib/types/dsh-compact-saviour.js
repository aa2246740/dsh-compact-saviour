import z from '@deepseek-ai/schemastery';
import { Controller } from './controller.js';
export const name = 'dsh-compact-saviour';
export const inject = ['agents', 'llm', 'tokenMeter', 'settings', 'sessionProjections', 'webServer', 'connection'];
const SettingsSchema = z.object({
    enabled: z.boolean().default(true).description('启用自动压缩辅助，手动压缩始终使用 Saviour 模型'),
    mode: z.union(['rescue', 'direct']).default('rescue').description('默认在官方连续失败两次后救援，可选直接使用 Saviour 模型'),
    provider: z.string().default('').description('独立压缩模型的 provider'),
    model: z.string().default('').description('独立压缩模型'),
    reasoningEffort: z.string().default('').description('压缩模型的 reasoning level'),
});
export const Config = z.object({
    enabled: z.boolean().default(true).volatile().description('启用自动压缩辅助，手动压缩始终使用 Saviour 模型'),
    mode: z.union(['rescue', 'direct']).default('rescue').volatile().description('默认在官方连续失败两次后救援，可选直接使用 Saviour 模型'),
    provider: z.string().default('').volatile().description('独立压缩模型的 provider'),
    model: z.string().default('').volatile().description('独立压缩模型'),
    reasoningEffort: z.string().default('').volatile().description('压缩模型的 reasoning level'),
});
function json(res, status, value) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(value));
}
async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json'))
        throw new Error('JSON required');
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192)
            throw new Error('Request too large');
        chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Invalid request');
    return data;
}
export function apply(ctx, config) {
    const settings = {
        get: () => ({ enabled: config.enabled.get(), mode: config.mode.get(), provider: config.provider.get(), model: config.model.get(), reasoningEffort: config.reasoningEffort.get() }),
        replace: (value) => ctx.settings.update('dsh-compact-saviour', value),
    };
    ctx.effect(() => ctx.settings.configure({ auto: false }));
    const controller = new Controller(ctx, settings);
    // Versioned route also recovers a running 0.1.0 Host whose unowned legacy
    // route cannot be released through the public WebServer API. All new route
    // registrations are fiber-owned and disappear before replacement on HMR.
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/api/dsh-compact-saviour/v1', handler: async (req, res) => {
            const rejection = ctx.connection.requestRejection(req);
            if (rejection) {
                json(res, rejection, { error: 'Unauthorized' });
                return;
            }
            if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) {
                json(res, 403, { error: 'Forbidden' });
                return;
            }
            try {
                const url = new URL(req.url, 'http://localhost');
                if (req.method === 'GET') {
                    if (url.searchParams.get('models') === '1') {
                        const results = await Promise.allSettled(ctx.llm.listProviders().map(p => ctx.llm.listModels(p.id)));
                        json(res, 200, { models: results.flatMap(r => r.status === 'fulfilled' ? r.value : []) });
                        return;
                    }
                    if (url.searchParams.has('provider') && url.searchParams.has('model')) {
                        const info = await ctx.llm.resolveModelInfo(url.searchParams.get('provider'), url.searchParams.get('model'));
                        json(res, 200, { efforts: info.reasoning?.efforts ?? [], contextWindow: info.context?.contextWindow, defaultEffort: info.reasoning?.defaultEffort });
                        return;
                    }
                    const id = url.searchParams.get('sessionId') ?? undefined;
                    json(res, 200, { ...controller.state(id), context: await controller.context(id) });
                    return;
                }
                if (req.method !== 'POST') {
                    json(res, 405, { error: 'Method not allowed' });
                    return;
                }
                const data = await body(req);
                if (data.action === 'settings') {
                    const value = SettingsSchema(data.config);
                    if ((value.provider === '') !== (value.model === ''))
                        throw new Error('请选择完整的压缩模型。');
                    if (value.provider) {
                        const info = await ctx.llm.resolveModelInfo(value.provider, value.model);
                        if (value.reasoningEffort && !info.reasoning?.efforts.some(e => e.id === value.reasoningEffort))
                            throw new Error('不支持这个 reasoning level。');
                    }
                    await settings.replace(value);
                    json(res, 200, controller.state());
                    return;
                }
                if (typeof data.sessionId !== 'string' || !['configured', 'current', 'cancel'].includes(String(data.action)))
                    throw new Error('Invalid action');
                json(res, 200, controller.request(data.sessionId, data.action));
            }
            catch (error) {
                json(res, 400, { error: error instanceof Error ? error.message : String(error) });
            }
        } }));
    ctx.logger.info('[my-plugins/dsh-compact-saviour] loaded');
}
//# sourceMappingURL=dsh-compact-saviour.js.map