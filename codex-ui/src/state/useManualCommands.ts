import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createCommandStore, runCommand } from '../lib/manual-commands-store.mjs';
import type { CommandStore, CommandStoreItem } from '../lib/manual-commands-store.mjs';
import type { Snapshot } from '../components/AgentPanel';

export type CommandItem = CommandStoreItem;
type Exec = (args: { session: string; command: string; id: string }) => Promise<Partial<CommandItem>>;
type Options = {
  session: string;
  snapshot: Snapshot | null;
  blocked: boolean;
  onError: (message: string) => void;
  exec?: Exec;
  maxConcurrent?: number;
};

const EMPTY_RESULTS: CommandItem[] = [];
const SESSION_ID_RE = /^ses_[a-zA-Z0-9]+$/;

async function defaultExec({ session, command }: { session: string; command: string; id: string }) {
  const response = await fetch('/api/agent/sessions/' + encodeURIComponent(session) + '/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, confirmed: true, timeoutMs: 30000 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as Partial<CommandItem>;
}

/**
 * Session-scoped manual command state.
 * The panel only controls the floating CommandPalette; results never force a
 * terminal surface into the chat stream.
 */
export function useManualCommands({
  session,
  snapshot,
  blocked,
  onError,
  exec = defaultExec,
  maxConcurrent = 1,
}: Options) {
  const storeRef = useRef<CommandStore | null>(null);
  if (!storeRef.current) storeRef.current = createCommandStore({ maxConcurrent });
  const store = storeRef.current;

  const subscribe = useCallback((listener: () => void) => {
    const unsubscribe = store.subscribe(listener);
    return () => { unsubscribe(); };
  }, [store]);
  const results = useSyncExternalStore(subscribe, () => store.results(session), () => EMPTY_RESULTS);
  const running = useSyncExternalStore(subscribe, () => store.running(session), () => false);
  const anyRunning = useSyncExternalStore(subscribe, () => store.anyRunning(), () => false);

  const [open, setOpen] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => { setOpen(false); }, [session]);

  const workspace = snapshot?.workspace || '';
  const hasPending = Boolean(snapshot?.permissions.length || snapshot?.forms.length);
  const guards = useMemo(() => ({
    agentRunning: blocked || Boolean(snapshot?.running),
    manualRunning: Boolean(snapshot?.manualRunning),
  }), [blocked, snapshot?.running, snapshot?.manualRunning]);
  const validSession = SESSION_ID_RE.test(session);
  const disabledReason = hasPending
    ? '请先处理待审批操作或问题。'
    : !validSession
      ? '会话尚未建立'
      : store.canRun(session, guards);

  const run = useCallback(async (command: string): Promise<boolean> => {
    const text = command.trim();
    if (!text) return false;
    const target = sessionRef.current;
    if (!SESSION_ID_RE.test(target)) return false;
    if (hasPending) {
      onError('请先处理待审批操作或问题。');
      return false;
    }
    if (store.canRun(target, guards)) return false;
    if (!window.confirm(`将在当前会话项目目录执行本地命令（非沙箱）：\n${workspace}\n\n${text}\n\n是否仅批准本次执行？`)) return false;
    try {
      await runCommand(store, target, text, exec, guards);
      setOpen(current => sessionRef.current === target ? false : current);
      return true;
    } catch (error) {
      onError(error instanceof Error ? error.message : '命令执行失败');
      return false;
    }
  }, [exec, guards, hasPending, onError, store, workspace]);

  const toggle = useCallback(() => setOpen(value => !value), []);
  const close = useCallback(() => setOpen(false), []);
  const clear = useCallback(() => store.clear(session), [store, session]);

  return {
    open, toggle, close, results, running, anyRunning, disabledReason, run, clear,
  };
}
