export const MAX_PROMPT_CHARS: number;
export const MAX_FILE_BYTES: number;
export const MAX_FILE_COUNT: number;
export function estimateTokens(text: string): number;
export function formatBytes(size: number): string;
export function validateFiles(files: File[]): void;
export function mergePrompt(text: string, files: File[], previousConversation?: string): Promise<string>;
