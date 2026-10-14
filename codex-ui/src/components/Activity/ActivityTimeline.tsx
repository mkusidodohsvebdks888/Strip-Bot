import { useEffect, useRef } from 'react';
import type { Task } from '../../types';
import { ActivityStep } from './ActivityStep';
import { Summary } from './Summary';
import styles from './Activity.module.css';

export interface ActivityTimelineProps {
  task: Task;
}

/**
 * Left panel of Task Detail. Maps task.activity to rows (a <Summary> for
 * `summary` steps, otherwise an <ActivityStep>) in a scrollable column and
 * auto-scrolls to the bottom on change. While task.status === 'running' a small
 * 3-dot running indicator (the dotpulse used by the typing indicator) shows
 * under the last step — unless the trailing step is the streaming summary,
 * which carries its own caret.
 */
export function ActivityTimeline({ task }: ActivityTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastStep = task.activity[task.activity.length - 1];
  const isRunning = task.status === 'running';
  const trailingSummaryStreams = isRunning && lastStep?.kind === 'summary';

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [task.activity, task.summary, task.status]);

  return (
    <div ref={scrollRef} className={styles.timeline}>
      {task.activity.map((step, i) => {
        if (step.kind === 'summary') {
          const isLast = i === task.activity.length - 1;
          const isStreaming = isRunning && isLast;
          // Each summary row renders its OWN text (step.text). The currently-
          // streaming last row mirrors task.summary so the live token stream
          // shows; earlier/finished summaries keep their captured text.
          const text = isStreaming ? task.summary : step.text ?? task.summary;
          return <Summary key={step.id} text={text} streaming={isStreaming} />;
        }
        return <ActivityStep key={step.id} step={step} />;
      })}

      {isRunning && !trailingSummaryStreams && (
        <div className={styles.running} role="status" aria-label="Working">
          <span className={styles.runningDots} aria-hidden="true">
            <span className={styles.runningDot} />
            <span className={`${styles.runningDot} ${styles.runningDot2}`} />
            <span className={`${styles.runningDot} ${styles.runningDot3}`} />
          </span>
          <span className={styles.runningLabel}>Working…</span>
        </div>
      )}
    </div>
  );
}
