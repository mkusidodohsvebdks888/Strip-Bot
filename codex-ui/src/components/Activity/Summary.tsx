import { Fragment } from 'react';
import styles from './Activity.module.css';

export interface SummaryProps {
  text: string;
  streaming?: boolean;
}

/**
 * The agent summary turn. Uses the existing message-text style (14px,
 * line-height 1.62, var(--text-message)); inline `backticked` spans render in
 * the mono font, and a blinking caret (animation: caret) shows while streaming.
 */

/** Split summary text into plain + inline-code segments on `backticks`. */
interface Segment {
  code: boolean;
  text: string;
}

function segments(text: string): Segment[] {
  const out: Segment[] = [];
  const parts = text.split('`');
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i] === '') continue;
    out.push({ code: i % 2 === 1, text: parts[i] });
  }
  return out;
}

export function Summary({ text, streaming }: SummaryProps) {
  return (
    <div className={styles.summary}>
      <span className={`${styles.glyph} ${styles.glyphSummary}`} aria-hidden="true">
        ❯
      </span>
      <p className={styles.summaryText}>
        {segments(text).map((seg, i) =>
          seg.code ? (
            <code className={styles.summaryCode} key={i}>
              {seg.text}
            </code>
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          ),
        )}
        {streaming && <span className={styles.caret} aria-hidden="true" />}
      </p>
    </div>
  );
}
