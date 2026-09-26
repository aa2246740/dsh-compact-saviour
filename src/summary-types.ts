import type { ContentBlock, Message, ToolSchema, TokenUsage } from '@deepseek-ai/dsh-llm';
export interface SummarizationInput { readonly tools?: readonly ToolSchema[]; readonly messages: readonly Message[] }
export type SummaryResult = {
  summary: ContentBlock[]; provider: string; model: string; maxTokens?: number; usage?: TokenUsage;
} & ({ rawOutput: ContentBlock[]; llmStreamCall: true } | { rawOutput?: ContentBlock[]; llmStreamCall?: never });
export function frameSummary(summary: readonly ContentBlock[]): ContentBlock[] {
  return [
    { type: 'text', text: 'This is an automatically generated checkpoint condensing an earlier span of the conversation to free up context. Treat the captured context as established background and build on it without restating it. Continue the task directly from the messages that follow, without acknowledging this checkpoint.\n\n<compacted-summary>' },
    ...summary, { type: 'text', text: '</compacted-summary>' },
  ];
}
