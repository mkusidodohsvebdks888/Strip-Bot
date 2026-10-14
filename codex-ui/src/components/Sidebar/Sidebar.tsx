import type { CSSProperties } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { Task, TaskStatus } from '../../types';
import { useTasks } from '../../store/TasksContext';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  userName: string;
  userInitial: string;
}

/**
 * Status -> dot color (keeps Home sidebar faithful: 1 accent, 1 amber, 3 faint).
 *   done -> var(--accent) ; running -> var(--dot-warning) (pulses) ;
 *   queued -> var(--faint) ; error -> var(--diff-del-sign)
 */
export function dotColor(status: TaskStatus): string {
  if (status === 'done') return 'var(--accent)';
  if (status === 'running') return 'var(--dot-warning)';
  if (status === 'error') return 'var(--diff-del-sign)';
  return 'var(--faint)';
}

/**
 * Title color (keeps the original sidebar look):
 *   active route -> var(--fg) ; done -> var(--fg) ;
 *   running -> var(--title-warning) ; otherwise -> var(--muted).
 */
function titleColor(status: TaskStatus, isActive: boolean): string {
  if (isActive || status === 'done') return 'var(--fg)';
  if (status === 'running') return 'var(--title-warning)';
  return 'var(--muted)';
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  done: 'Done',
  running: 'Running',
  queued: 'Queued',
  error: 'Error',
};

const GROUP_ORDER: Array<Task['group']> = ['Today', 'Yesterday'];

export function Sidebar({ userName, userInitial }: SidebarProps) {
  const { tasks } = useTasks();
  const navigate = useNavigate();

  const groups = GROUP_ORDER.map((label) => ({
    label,
    items: tasks.filter((t) => t.group === label),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className={styles.sidebar}>
      {/* (a) brand row */}
      <div className={styles.brand}>
        <div className={styles.logo} aria-hidden="true">
          {'❯'}
        </div>
        <span className={styles.wordmark}>Codex</span>
        <span className={styles.version}>v1</span>
      </div>

      {/* (b) New task button */}
      <div className={styles.newTaskWrap}>
        <button
          type="button"
          className={styles.newTask}
          onClick={() => navigate('/')}
        >
          <span className={styles.newTaskPlus} aria-hidden="true">
            +
          </span>{' '}
          New task
          <span className={styles.newTaskShortcut} aria-hidden="true">
            {'⌘'}K
          </span>
        </button>
      </div>

      {/* (c) Search box */}
      <div className={styles.searchWrap}>
        <div className={styles.search}>
          <span className={styles.searchGlyph} aria-hidden="true">
            {'⚲'}
          </span>
          <span className={styles.searchLabel}>Search tasks</span>
        </div>
      </div>

      {/* (d) Task list */}
      <nav className={styles.list} aria-label="Tasks">
        {groups.map((group) => (
          <div key={group.label}>
            <div className={styles.groupLabel}>{group.label}</div>
            {group.items.map((task) => (
              <NavLink
                key={task.id}
                to={`/tasks/${task.id}`}
                className={({ isActive }) =>
                  isActive ? `${styles.item} ${styles.itemActive}` : styles.item
                }
                title={task.title}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={
                        task.status === 'running'
                          ? `${styles.dot} ${styles.dotPulse}`
                          : styles.dot
                      }
                      style={{ background: dotColor(task.status) } as CSSProperties}
                      role="img"
                      aria-label={STATUS_LABEL[task.status]}
                    />
                    <div className={styles.itemBody}>
                      <div
                        className={styles.itemTitle}
                        style={
                          { color: titleColor(task.status, isActive) } as CSSProperties
                        }
                      >
                        {task.title}
                      </div>
                      <div className={styles.itemRepo}>{task.repo}</div>
                    </div>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* (e) Footer */}
      <div className={styles.footer}>
        <div className={styles.avatar} aria-hidden="true">
          {userInitial}
        </div>
        <div className={styles.footerBody}>
          <div className={styles.userName}>{userName}</div>
          <div className={styles.plan}>Pro plan</div>
        </div>
        <span className={styles.footerMenu} aria-hidden="true">
          {'⋯'}
        </span>
      </div>
    </aside>
  );
}
