import { useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { composer } from '../../data';
import styles from './Composer.module.css';

export interface ComposerProps {
  draft: string;
  focused: boolean;
  canSend: boolean;
  model: string;
  onDraftChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSend: () => void;
  onCycleModel: () => void;
}

export function Composer({
  draft,
  focused,
  canSend,
  model,
  onDraftChange,
  onKeyDown,
  onFocus,
  onBlur,
  onSend,
  onCycleModel,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (draft === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [draft]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onDraftChange(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.inner}>
        <div className={`${styles.box}${focused ? ` ${styles.focused}` : ''}`}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            rows={1}
            placeholder={composer.placeholder}
            className={styles.textarea}
          />
          <div className={styles.toolbar}>
            <button type="button" className={styles.attach} aria-label="Attach">
              +
            </button>
            <button
              type="button"
              className={styles.model}
              onClick={onCycleModel}
            >
              {model}{' '}
              <span className={styles.caret} aria-hidden="true">
                &#9662;
              </span>
            </button>
            <span className={styles.auto}>
              <span className={styles.gear} aria-hidden="true">
                &#9881;
              </span>{' '}
              Auto
            </span>
            <button
              type="button"
              className={`${styles.send}${canSend ? ` ${styles.canSend}` : ''}`}
              onClick={onSend}
              aria-label="Send"
            >
              &#8593;
            </button>
          </div>
        </div>
        <div className={styles.hint}>
          {composer.footer}{' '}
          <span className={styles.hintMono}>{composer.footerMono}</span>
        </div>
      </div>
    </div>
  );
}
