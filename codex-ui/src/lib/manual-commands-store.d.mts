export type CommandStoreItem = {
  id: string;
  session: string;
  command: string;
  status: 'running' | 'done' | 'exit' | 'timeout' | 'failed';
  stdout: string;
  stderr: string;
  error: string | null;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  startedAt: number;
  durationMs: number;
  cwd?: string;
};
export type CommandStore = {
  subscribe(fn: () => void): () => boolean;
  results(session: string): CommandStoreItem[];
  running(session: string): boolean;
  anyRunning(): boolean;
  inflightCount(): number;
  canRun(session: string, guards?: {agentRunning?: boolean; manualRunning?: boolean}): string | null;
  begin(session: string, command: string): string;
  finish(session: string, id: string, result: Partial<CommandStoreItem>): void;
  append(session: string, id: string, chunk: {stdout?: string; stderr?: string}): void;
  clear(session: string): void;
};
export function createCommandStore(options?: {maxConcurrent?: number; now?: () => number}): CommandStore;
export function runCommand(
  store: CommandStore,
  session: string,
  command: string,
  exec: (args: {session: string; command: string; id: string}) => Promise<Partial<CommandStoreItem>>,
  guards?: {agentRunning?: boolean; manualRunning?: boolean},
): Promise<string>;
export const MAX_RESULTS_PER_SESSION: number;