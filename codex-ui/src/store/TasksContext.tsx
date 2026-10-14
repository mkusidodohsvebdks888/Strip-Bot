import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import type { Task } from '../types';
import {
  buildFlakyCheckoutContinuation,
  buildFollowUpRun,
  buildRun,
  seededTasks,
  slugFromPrompt,
  titleFromPrompt,
} from '../data/tasks';
import { runTask, type CancelRun } from '../lib/runEngine';

export interface TasksContextValue {
  tasks: Task[];
  getTask(id: string): Task | undefined;
  /** creates a 'running' task with a scripted run, returns id, starts the run engine */
  createTask(prompt: string): string;
  /** appends a short mini-run, updates files */
  followUp(taskId: string, text: string): void;
  /** mocks PR creation: sets prNumber, shows a toast */
  createPR(taskId: string): void;
  /** current transient toast message (or null) */
  toast: string | null;
  dismissToast(): void;
}

const TasksContext = createContext<TasksContextValue | null>(null);

const TOAST_MS = 2600;

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => seededTasks.map((t) => ({ ...t })));
  const [toast, setToast] = useState<string | null>(null);

  // Live mirror of tasks for timer callbacks (avoids stale closures).
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Active run cancels, keyed by task id. Cleaned up on unmount.
  const runs = useRef<Map<string, CancelRun>>(new Map());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getTask = useCallback(
    (id: string) => tasksRef.current.find((t) => t.id === id),
    [],
  );

  const patchTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Start (or restart) the run engine for a task with a given template.
  const startRun = useCallback(
    (id: string, template: ReturnType<typeof buildRun>) => {
      // Cancel any existing run for this id first (leak-free).
      runs.current.get(id)?.();
      const cancel = runTask(template, {
        onPatch: (patch) => patchTask(id, patch),
        getTask: () => tasksRef.current.find((t) => t.id === id),
        onDone: () => {
          // Prune this run's dead handle, but only if it is still the active
          // one (a follow-up may have replaced it with a fresh run).
          if (runs.current.get(id) === cancel) runs.current.delete(id);
        },
      });
      runs.current.set(id, cancel);
    },
    [patchTask],
  );

  // Cancel + forget the active run for a task (route-change / explicit stop).
  const cancelRun = useCallback((id: string) => {
    const cancel = runs.current.get(id);
    if (cancel) {
      cancel();
      runs.current.delete(id);
    }
  }, []);

  const createTask = useCallback(
    (prompt: string): string => {
      const id = slugFromPrompt(prompt);
      const template = buildRun(prompt);
      const task: Task = {
        id,
        title: titleFromPrompt(prompt),
        repo: 'codex-web',
        branch: 'main',
        group: 'Today',
        prompt,
        status: 'running',
        activity: [],
        files: [],
        summary: '',
      };
      setTasks((cur) => [task, ...cur]);
      // Defer engine start to the next tick so the task exists in state.
      queueMicrotask(() => startRun(id, template));
      return id;
    },
    [startRun],
  );

  const followUp = useCallback(
    (taskId: string, text: string) => {
      const cur = tasksRef.current.find((t) => t.id === taskId);
      if (!cur || !text.trim()) return;
      // Only a settled task accepts a follow-up. A 'queued' task never ran, and
      // a 'running' task is mid-run — both would produce an incoherent sequence.
      if (cur.status === 'queued' || cur.status === 'running') return;
      const template = buildFollowUpRun(text);
      // Append a user follow-up marker, flip back to running, keep prior files.
      patchTask(taskId, {
        status: 'running',
        activity: [
          ...cur.activity,
          {
            id: `fu-${Date.now().toString(36)}`,
            kind: 'read',
            title: `You: ${text.trim()}`,
            status: 'ok',
          },
        ],
      });
      queueMicrotask(() => startRun(taskId, template));
    },
    [patchTask, startRun],
  );

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const createPR = useCallback(
    (taskId: string) => {
      const cur = tasksRef.current.find((t) => t.id === taskId);
      if (!cur || cur.status !== 'done' || cur.prNumber) return;
      const prNumber = 1280 + Math.floor(Math.random() * 400);
      patchTask(taskId, { prNumber });
      showToast('Pull request created');
    },
    [patchTask, showToast],
  );

  // Drive runs from the route. On every navigation:
  //  - cancel the engine for any task whose detail route is no longer shown
  //    (spec: clear timers on route change / New task) — otherwise leaving a
  //    streaming task keeps firing setTimeout chains, appending steps and
  //    flipping status off-screen;
  //  - start the seeded `fix-flaky-checkout` continuation when its detail route
  //    is opened (spec: a running seeded task "animates on open"), so its run
  //    never animates in the background.
  const location = useLocation();
  useEffect(() => {
    const match = /^\/tasks\/(.+)$/.exec(location.pathname);
    const activeId = match ? decodeURIComponent(match[1]) : null;

    for (const id of Array.from(runs.current.keys())) {
      if (id !== activeId) cancelRun(id);
    }

    if (activeId === 'fix-flaky-checkout' && !runs.current.has(activeId)) {
      const t = tasksRef.current.find((task) => task.id === activeId);
      // Only start the continuation the first time the route is opened. If its
      // steps are already present (e.g. the run started, then was cancelled by
      // navigating away mid-stream), do not re-append them — that would create
      // duplicate step ids. The task simply stays where it froze.
      const alreadyStarted = t?.activity.some((s) => s.id === 'fc-5');
      if (t && t.status === 'running' && !alreadyStarted) {
        startRun(activeId, buildFlakyCheckoutContinuation());
      }
    }
  }, [location.pathname, cancelRun, startRun]);

  // Clean up all runs + toast timer on unmount.
  useEffect(() => {
    const active = runs.current;
    return () => {
      active.forEach((cancel) => cancel());
      active.clear();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks,
      getTask,
      createTask,
      followUp,
      createPR,
      toast,
      dismissToast,
    }),
    [tasks, getTask, createTask, followUp, createPR, toast, dismissToast],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error('useTasks must be used within a <TasksProvider>');
  }
  return ctx;
}
