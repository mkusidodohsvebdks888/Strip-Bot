import styles from './Toast.module.css';

export interface ToastProps {
  message: string;
  onDismiss?: () => void;
}

/**
 * A small transient confirmation pill (e.g. "Pull request created").
 * The store auto-dismisses it on a timer; clicking also dismisses.
 * It is a button so it is keyboard-accessible and announced via role="status".
 */
export function Toast({ message, onDismiss }: ToastProps) {
  return (
    <button
      type="button"
      className={styles.toast}
      onClick={onDismiss}
      aria-label={`${message}. Dismiss notification`}
    >
      <span className={styles.dot} aria-hidden="true">
        ✓
      </span>
      <span className={styles.message}>{message}</span>
    </button>
  );
}
