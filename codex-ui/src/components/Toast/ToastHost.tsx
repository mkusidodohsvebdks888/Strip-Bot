import { useTasks } from '../../store/TasksContext';
import { Toast } from './Toast';
import styles from './Toast.module.css';

/**
 * Mounted once in the App shell. Reads the current toast from the tasks store
 * and renders a transient <Toast/> near the bottom-center. The store times the
 * toast out; the rendered pill also dismisses on click. The host is an
 * aria-live region so the message is announced when it appears.
 */
export function ToastHost() {
  const { toast, dismissToast } = useTasks();

  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
