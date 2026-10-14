import type { ActivityStep, ChangedFile, Task } from '../types';
import type { RunTemplate } from '../data/tasks';

/**
 * Animated, cancelable run scheduler. Drives a task from 'running' -> 'done'
 * by revealing activity steps, streaming terminal/summary text, and filling
 * the Files changed panel progressively over time. Reuses the existing
 * streaming feel from useCodexChat: ~120ms before the first step, tokens at
 * 22 + random*26ms, small 250–500ms inter-step delays.
 *
 * Usage:
 *   const cancel = runTask(template, { onPatch });
 *   // ...later (unmount / route change / New task):
 *   cancel();
 *
 * `onPatch` receives a shallow patch to merge into the task. It is only called
 * while the run is live; after `cancel()` no further callbacks fire.
 */

export interface RunHandlers {
  /** merge this patch into the task's current state */
  onPatch: (patch: Partial<Task>) => void;
  /** read the task's current state (for append/accumulate operations) */
  getTask: () => Task | undefined;
  /**
   * Called once when the run reaches its end naturally (status flipped to
   * 'done'). Lets the store prune the now-dead cancel handle from its Map so it
   * does not grow by one entry per created task for the provider's lifetime.
   * Not called on cancel().
   */
  onDone?: () => void;
}

export type CancelRun = () => void;

// Match the existing streaming feel.
const FIRST_DELAY = 120;
const tokenDelay = () => 22 + Math.random() * 26;
const interStepDelay = () => 250 + Math.random() * 250;

export function runTask(template: RunTemplate, handlers: RunHandlers): CancelRun {
  const { onPatch, getTask, onDone } = handlers;

  let cancelled = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!cancelled) fn();
    }, ms);
    timers.add(t);
    return t;
  };

  const cancel: CancelRun = () => {
    cancelled = true;
    timers.forEach(clearTimeout);
    timers.clear();
  };

  // ----- helpers that operate on the latest task snapshot -----

  const appendStep = (step: ActivityStep) => {
    const cur = getTask();
    if (!cur) return;
    onPatch({ activity: [...cur.activity, step] });
  };

  const patchStep = (id: string, patch: Partial<ActivityStep>) => {
    const cur = getTask();
    if (!cur) return;
    onPatch({
      activity: cur.activity.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const revealFiles = (paths: string[]) => {
    if (!paths.length) return;
    const cur = getTask();
    if (!cur) return;
    const have = new Set(cur.files.map((f) => f.path));
    const toAdd = template.files.filter(
      (f) => paths.includes(f.path) && !have.has(f.path),
    );
    if (!toAdd.length) return;
    onPatch({ files: [...cur.files, ...toAdd] });
  };

  // Stream summary text token-by-token. The partial text is written into the
  // summary step's own `text` field (and mirrored into task.summary for the
  // currently-streaming row) so each summary turn keeps its own text — multiple
  // summaries from follow-ups no longer collapse onto the single task.summary.
  const streamSummary = (stepId: string, full: string, done: () => void) => {
    const tokens = full.split(/(\s+)/);
    let i = 0;
    onPatch({ summary: '' });
    patchStep(stepId, { text: '' });
    const step = () => {
      i += 1;
      const partial = tokens.slice(0, i).join('');
      onPatch({ summary: partial });
      patchStep(stepId, { text: partial });
      if (i < tokens.length) {
        later(step, tokenDelay());
      } else {
        patchStep(stepId, { status: 'ok', text: full });
        done();
      }
    };
    later(step, tokenDelay());
  };

  // ----- main schedule: reveal each step in order -----

  const runStep = (index: number) => {
    if (index >= template.activity.length) {
      // All steps done -> task is done. Signal completion so the store can
      // prune this run's (now dead) cancel handle.
      onPatch({ status: 'done' });
      onDone?.();
      return;
    }

    const step = template.activity[index];

    // Append the step in a 'running' state first.
    appendStep({ ...step, status: 'running' });

    const advance = () => later(() => runStep(index + 1), interStepDelay());

    if (step.kind === 'summary') {
      // Stream the summary text, then advance.
      streamSummary(step.id, template.summary, advance);
      return;
    }

    // Non-summary step: let it "work" briefly, mark ok, reveal any files.
    const workMs =
      step.kind === 'command'
        ? 360 + Math.random() * 320
        : 220 + Math.random() * 220;

    later(() => {
      const finalStatus = step.status ?? 'ok';
      patchStep(step.id, { status: finalStatus });
      const reveal = template.revealFiles[step.id];
      if (reveal) revealFiles(reveal);
      advance();
    }, workMs);
  };

  later(() => runStep(0), FIRST_DELAY);

  return cancel;
}

/** Sum added/removed across changed files (kept here for engine consumers). */
export function totalsOf(files: ChangedFile[]): { added: number; removed: number } {
  return files.reduce(
    (acc, f) => ({ added: acc.added + f.added, removed: acc.removed + f.removed }),
    { added: 0, removed: 0 },
  );
}
