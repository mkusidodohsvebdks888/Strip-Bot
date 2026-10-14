import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { models as MODELS } from '../data';

/**
 * Composer state extracted from the original chat flow so both Home (compose a
 * new task) and Task Detail (follow-up) can drive the existing <Composer>
 * without changing its prop contract:
 *   draft, focused, canSend, model, onDraftChange, onKeyDown, onFocus, onBlur,
 *   onSend, onCycleModel
 *
 * The owner supplies `onSubmit(text)` (e.g. createTask / followUp). Enter sends
 * (unless Shift is held for a newline); the draft resets after a successful
 * submit.
 */

export interface UseComposer {
  draft: string;
  model: string;
  models: string[];
  focused: boolean;
  canSend: boolean;
  setDraft(v: string): void;
  setFocused(b: boolean): void;
  cycleModel(): void;
  send(): void;
  reset(): void;
  onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void;
}

export interface UseComposerOptions {
  /** invoked with the trimmed draft on a valid send */
  onSubmit: (text: string) => void;
  /** disable sending (e.g. while another action is in flight) */
  disabled?: boolean;
}

export function useComposer({ onSubmit, disabled = false }: UseComposerOptions): UseComposer {
  const [draft, setDraftState] = useState('');
  const [modelIndex, setModelIndex] = useState(0);
  const [focused, setFocusedState] = useState(false);

  const model = MODELS[modelIndex];
  const canSend = draft.trim().length > 0 && !disabled;

  const setDraft = useCallback((v: string) => setDraftState(v), []);
  const setFocused = useCallback((b: boolean) => setFocusedState(b), []);

  const cycleModel = useCallback(() => {
    setModelIndex((idx) => (idx + 1) % MODELS.length);
  }, []);

  const reset = useCallback(() => setDraftState(''), []);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setDraftState('');
  }, [draft, disabled, onSubmit]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return {
    draft,
    model,
    models: MODELS,
    focused,
    canSend,
    setDraft,
    setFocused,
    cycleModel,
    send,
    reset,
    onKeyDown,
  };
}
