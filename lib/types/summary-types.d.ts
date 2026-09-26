import type { ContentBlock, Message, ToolSchema, TokenUsage } from '@deepseek-ai/dsh-llm';
export interface SummarizationInput {
    readonly tools?: readonly ToolSchema[];
    readonly messages: readonly Message[];
}
export type SummaryResult = {
    summary: ContentBlock[];
    provider: string;
    model: string;
    maxTokens?: number;
    usage?: TokenUsage;
} & ({
    rawOutput: ContentBlock[];
    llmStreamCall: true;
} | {
    rawOutput?: ContentBlock[];
    llmStreamCall?: never;
});
export declare function frameSummary(summary: readonly ContentBlock[]): ContentBlock[];
//# sourceMappingURL=summary-types.d.ts.map