import styles from './MessageThread.module.css';

export interface TypingIndicatorProps {
  thinkingLabel: string;
}

export function TypingIndicator({ thinkingLabel }: TypingIndicatorProps) {
  return (
    <div className={styles.row}>
      <div className={styles.avatarAssistant} aria-hidden="true">
        {'❯'}
      </div>
      <div className={styles.typingBody}>
        <span className={styles.dots} aria-hidden="true">
          <span className={styles.dot} />
          <span className={`${styles.dot} ${styles.dot2}`} />
          <span className={`${styles.dot} ${styles.dot3}`} />
        </span>
        <span className={styles.typingLabel}>{thinkingLabel}</span>
      </div>
    </div>
  );
}
