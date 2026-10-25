import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {Icon} from '../Icons';
import './ChatInput.css';

type Props = {
  onSend: (text: string) => void;
  /** 生成中为 true；变回 false 时停止按钮自动复位 */
  busy?: boolean;
  /** 点击停止时调用；可返回 Promise，期间按钮显示“停止中”并禁用 */
  onStop?: () => void | Promise<void>;
  /** 生成中按 Esc 是否停止（焦点在输入框内） */
  stopOnEscape?: boolean;
  disabled?: boolean;
  maxHeight?: number;
  placeholder?: string;
  autoFocus?: boolean;
};

export function ChatInput({
  onSend,
  busy = false,
  onStop,
  stopOnEscape = true,
  disabled = false,
  maxHeight = 240,
  placeholder = '输入消息，Enter 发送，Shift+Enter 换行',
  autoFocus = false,
}: Props) {
  const [value, setValue] = useState('');
  const [stopping, setStopping] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [announce, setAnnounce] = useState('');
  const composing = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const stoppingRef = useRef(false);
  const announceTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, maxHeight]);

  // 父级 busy 变回 false 后复位停止中状态，并把焦点还给输入框。
  useEffect(() => {
    if (busy || !stopping || stopPending) return;
    stoppingRef.current = false;
    setStopping(false);
    setAnnounce('已停止生成');
    ref.current?.focus();
    if (announceTimer.current !== undefined) window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => {
      setAnnounce('');
      announceTimer.current = undefined;
    }, 1500);
  }, [busy, stopping, stopPending]);

  useEffect(() => () => {
    if (announceTimer.current !== undefined) window.clearTimeout(announceTimer.current);
  }, []);

  const stop = async () => {
    if (!busy || stoppingRef.current || !onStop) return;
    // useRef is a synchronous lock, so a rapid double click cannot call onStop twice
    // before React commits the disabled state.
    stoppingRef.current = true;
    setStopping(true);
    setStopPending(true);
    setAnnounce('');
    try {
      await onStop();
    } catch {
      stoppingRef.current = false;
      setStopping(false);
    } finally {
      setStopPending(false);
    }
  };

  const canSend = !disabled && !busy && !stopping && value.trim().length > 0;
  const send = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && busy && stopOnEscape) {
      e.preventDefault();
      void stop();
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (composing.current || e.nativeEvent.isComposing) return;
    e.preventDefault();
    send();
  };

  const showStop = busy && !!onStop;
  const stopVisible = showStop || stopping;
  const state = stopping ? 'stopping' : showStop ? 'stop' : 'send';

  return (
    <div className={`strip-input${busy ? ' strip-input--busy' : ''}${stopping ? ' strip-input--stopping' : ''}`}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={busy ? '正在生成… 可继续输入，Esc 停止' : placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        aria-label="消息输入框"
        onChange={e => setValue(e.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={onKeyDown}
      />

      {/* 发送和停止共用一个固定槽位，切换时不改变布局。 */}
      <div className="strip-input__slot" data-state={state}>
        <button
          type="button"
          className="strip-input__send"
          onClick={send}
          disabled={!canSend}
          tabIndex={stopVisible ? -1 : 0}
          aria-hidden={stopVisible}
          aria-label="发送"
          title="发送 (Enter)"
        >
          <Icon name="arrow-up" />
        </button>

        <button
          type="button"
          className="strip-input__stop"
          onClick={() => void stop()}
          disabled={!showStop || stopping}
          tabIndex={stopVisible ? 0 : -1}
          aria-hidden={!stopVisible}
          aria-label={stopping ? '正在停止' : '停止生成'}
          aria-busy={stopping}
          title={stopping ? '正在停止…' : '停止生成 (Esc)'}
        >
          <span className="strip-input__ring" aria-hidden="true" />
          <span className="strip-input__stop-icon" aria-hidden="true">
            {stopping ? <Icon name="loader-circle" /> : <span className="strip-input__square" />}
          </span>
        </button>
      </div>

      <span className="strip-sr-only" role="status" aria-live="polite">{announce}</span>
    </div>
  );
}
