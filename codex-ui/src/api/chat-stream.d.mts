export function streamChat(payload: unknown, options: {signal: AbortSignal; onDelta: (text: string) => void; fetchImpl?: typeof fetch}): Promise<string>;
