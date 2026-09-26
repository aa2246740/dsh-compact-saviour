export interface Config { enabled: boolean; mode?: 'direct' | 'rescue'; provider: string; model: string; reasoningEffort: string }
export interface Target { provider: string; model: string; reasoningEffort?: string }
export interface ModelOption { provider: string; id: string; name: string }
export interface JobView {
  phase: 'idle' | 'queued' | 'running' | 'done' | 'failed';
  message: string; failures: number; completed?: number; total?: number; current?: Target;
  beforeTokens?: number; afterTokens?: number;
}
export interface ContextView {
  usedTokens: number; reportedTokens: number; contextWindow: number; corrected: boolean;
  reason?: 'invalid-usage' | 'model-switch'; parts?: number[];
}
export interface State { config: Config; job: JobView; available: boolean; context?: ContextView }
