import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { KeyboardEvent } from 'react';
import { buildReply, models as MODELS } from '../data';
import type { Message } from '../types';

export interface UseCodexChat {
  messages: Message[];
  draft: string;
  generating: boolean;
  model: string;
  models: string[];
  focused: boolean;
  copiedId: string | null;
  canSend: boolean;
  threadRef: RefObject<HTMLDivElement>;
  setDraft(v: string): void;
  setFocused(b: boolean): void;
  send(): void;
  sendPrompt(text: string): void;
  cycleModel(): void;
  newTask(): void;
  copyCode(id: string): void;
  onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void;
}

export function useCodexChat(): UseCodexChat {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraftState] = useState('');
  const [generating, setGenerating] = useState(false);
  const [modelIndex, setModelIndex] = useState(0);
  const [focused, setFocusedState] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // keep a live mirror of state we read inside async timer callbacks
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const generatingRef = useRef(generating);
  generatingRef.current = generating;
  const modelIndexRef = useRef(modelIndex);
  modelIndexRef.current = modelIndex;

  const model = MODELS[modelIndex];

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  }, []);

  const updateMsg = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((s) => s.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const startAssistant = useCallback(
    (assistantModel: string) => {
      const reply = buildReply();
      const id = 'a' + Date.now();
      const msg: Message = {
        id,
        role: 'assistant',
        model: assistantModel,
        text: '',
        streaming: true,
        showCode: false,
        showDiff: false,
        fileName: reply.fileName,
        lang: reply.lang,
        codeLines: reply.codeLines,
        diffFile: reply.diffFile,
        added: reply.added,
        removed: reply.removed,
        diffLines: reply.diffLines,
      };
      setGenerating(false);
      setMessages((s) => [...s, msg]);

      const words = reply.text.split(/(\s+)/);
      let i = 0;
      const step = () => {
        i++;
        const partial = words.slice(0, i).join('');
        updateMsg(id, { text: partial });
        if (i < words.length) {
          later(step, 22 + Math.random() * 26);
        } else {
          updateMsg(id, { streaming: false });
          later(() => updateMsg(id, { showCode: true }), 240);
          later(() => updateMsg(id, { showDiff: true }), 560);
        }
      };
      later(step, 120);
    },
    [later, updateMsg],
  );

  const doSend = useCallback(
    (forced?: string) => {
      const text = (forced != null ? forced : draftRef.current).trim();
      if (!text || generatingRef.current) return;
      const sendModel = MODELS[modelIndexRef.current];
      const userMsg: Message = { id: 'u' + Date.now(), role: 'user', text };
      setMessages((s) => [...s, userMsg]);
      setDraftState('');
      setGenerating(true);
      later(() => startAssistant(sendModel), 750);
    },
    [later, startAssistant],
  );

  const send = useCallback(() => doSend(), [doSend]);
  const sendPrompt = useCallback((text: string) => doSend(text), [doSend]);

  const setDraft = useCallback((v: string) => setDraftState(v), []);
  const setFocused = useCallback((b: boolean) => setFocusedState(b), []);

  const cycleModel = useCallback(() => {
    setModelIndex((idx) => (idx + 1) % MODELS.length);
  }, []);

  const newTask = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]);
    setGenerating(false);
    setDraftState('');
  }, []);

  const copyCode = useCallback(
    (id: string) => {
      setMessages((s) => {
        const m = s.find((x) => x.id === id);
        if (m && m.codeLines && navigator.clipboard) {
          navigator.clipboard.writeText(m.codeLines.join('\n')).catch(() => {});
        }
        return s;
      });
      setCopiedId(id);
      later(() => {
        setCopiedId((cur) => (cur === id ? null : cur));
      }, 1400);
    },
    [later],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  // scroll thread to bottom on messages / generating change
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, generating]);

  // clear timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach(clearTimeout);
    };
  }, []);

  const canSend = draft.trim().length > 0 && !generating;

  return {
    messages,
    draft,
    generating,
    model,
    models: MODELS,
    focused,
    copiedId,
    canSend,
    threadRef,
    setDraft,
    setFocused,
    send,
    sendPrompt,
    cycleModel,
    newTask,
    copyCode,
    onKeyDown,
  };
}
