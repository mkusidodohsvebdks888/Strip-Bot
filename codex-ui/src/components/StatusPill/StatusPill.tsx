import type { TaskStatus } from '../../types';
import styles from './StatusPill.module.css';

export interface StatusPillProps {
  status: TaskStatus;
}

const LABEL: Record<TaskStatus, string> = {
  running: 'Running',
  done: 'Done',
  queued: 'Queued',
  error: 'Error',
};

/**
 * Small status pill mirroring the header pill idiom (surface-3 bg, border-07,
 * radius 7px). A colored dot + a UI-font label:
 *   running -> amber dot (pulse) + "Running"
 *   done    -> accent dot + check + "Done"
 *   queued  -> faint dot + "Queued"
 *   error   -> red dot + "Error"
 */
export function StatusPill({ status }: StatusPillProps) {
  const dotClass =
    status === 'running' ? `${styles.dot} ${styles.dotPulse}` : styles.dot;

  return (
    <span
      className={`${styles.pill} ${styles[status]}`}
      role="status"
      aria-label={LABEL[status]}
    >
      {status === 'done' ? (
        <span className={styles.check} aria-hidden="true">
          &#10003;
        </span>
      ) : (
        <span className={dotClass} aria-hidden="true" />
      )}
      <span className={styles.label}>{LABEL[status]}</span>
    </span>
  );
}
