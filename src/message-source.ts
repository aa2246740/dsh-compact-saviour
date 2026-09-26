import type { ContextFormed } from '@deepseek-ai/dsh-llm'
declare module '@deepseek-ai/dsh-llm' {
 interface MessageSourceMap { 'plugin:dsh-compact-saviour': { kind: 'plugin:dsh-compact-saviour' } & ContextFormed }
}
