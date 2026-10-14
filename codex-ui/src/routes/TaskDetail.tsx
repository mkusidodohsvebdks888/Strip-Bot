import { Navigate, useParams } from 'react-router-dom';
import { Composer } from '../components/Composer/Composer';
import { TaskHeader } from '../components/TaskHeader/TaskHeader';
import { ActivityTimeline } from '../components/Activity/ActivityTimeline';
import { FilesChangedPanel } from '../components/FilesChanged/FilesChangedPanel';
import { useComposer } from '../hooks/useComposer';
import { useTasks } from '../store/TasksContext';
import { diffTotals } from '../lib/diff';
import styles from './TaskDetail.module.css';

/**
 * Task Detail (`/tasks/:taskId`): two-panel run view (Activity | Files changed)
 * + a follow-up composer at the bottom. Unknown id -> <Navigate to='/'/>.
 *
 * SKELETON — wired to the real store + (stub) components. Fully assembled in
 * Phase 3; the prop wiring here is authoritative.
 */
export function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const { getTask, followUp, createPR } = useTasks();

  const task = taskId ? getTask(taskId) : undefined;

  const composer = useComposer({
    onSubmit: (text) => {
      if (taskId) followUp(taskId, text);
    },
    // Follow-up only makes sense once a run has produced something. A 'queued'
    // task ('waiting for an available environment') or a 'running' one should
    // not accept follow-ups.
    disabled: task?.status === 'running' || task?.status === 'queued',
  });

  if (!task) {
    return <Navigate to="/" replace />;
  }

  const { added, removed } = diffTotals(task.files);

  return (
    <>
      <TaskHeader task={task} onCreatePR={() => createPR(task.id)} />
      <div className={styles.body}>
        <div className={styles.left}>
          <ActivityTimeline task={task} />
        </div>
        <div className={styles.right}>
          <FilesChangedPanel
            files={task.files}
            added={added}
            removed={removed}
            status={task.status}
          />
        </div>
      </div>
      <Composer
        draft={composer.draft}
        focused={composer.focused}
        canSend={composer.canSend}
        model={composer.model}
        onDraftChange={composer.setDraft}
        onKeyDown={composer.onKeyDown}
        onFocus={() => composer.setFocused(true)}
        onBlur={() => composer.setFocused(false)}
        onSend={composer.send}
        onCycleModel={composer.cycleModel}
      />
    </>
  );
}
