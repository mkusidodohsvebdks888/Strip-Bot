export function stabilizeMarkdown(text:string): string;
export type FenceTracker = { stabilize(text:string): string; reset(): void };
export function createFenceTracker(): FenceTracker;