import type { Task } from '../../types';
import { StatusPill } from '../StatusPill/StatusPill';
import styles from './TaskHeader.module.css';

export interface TaskHeaderProps {
  task: Task;
  onCreatePR: () => void;
}

/**
 * Task detail header — same 52px shell as ChatHeader.
 * left: repo (mono) "/" branch badge (⎇ in accent);
 * right: <StatusPill/> + actions. When done, a "Create PR" button calls
 * onCreatePR; once a PR exists it becomes a "View PR #N" link. Plus a refresh
 * icon button.
 */
export function TaskHeader({ task, onCreatePR }: TaskHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.repo}>{task.repo}</span>
        <span className={styles.sep}>/</span>
        <span className={styles.branch}>
          <span className={styles.branchGlyph} aria-hidden="true">
            &#9095;
          </span>{' '}
          {task.branch}
        </span>
      </div>
      <div className={styles.right}>
        <StatusPill status={task.status} />
        {task.status === 'done' &&
          (task.prNumber ? (
            <a
              className={styles.viewPr}
              href={`https://github.com/openai/codex-web/pull/${task.prNumber}`}
              target="_blank"
              rel="noreferrer"
            >
              View PR #{task.prNumber}
            </a>
          ) : (
            <button
              type="button"
              className={styles.createPr}
              onClick={onCreatePR}
            >
              Create PR
            </button>
          ))}
        <button type="button" className={styles.refresh} aria-label="Refresh">
          &#8635;
        </button>
      </div>
    </header>
  );
}
