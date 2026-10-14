import type { ActivityStep as ActivityStepData, StepKind } from '../../types';
import { Terminal } from './Terminal';
import styles from './Activity.module.css';

export interface ActivityStepProps {
  step: ActivityStepData;
}

/**
 * One activity row: a leading glyph by kind (read = eye, command = "$", edit =
 * pencil, summary = ❯), then the title. For `command` the detail renders as a
 * <Terminal>; for `read`/`edit` the detail renders as a compact mono file list.
 * (summary steps are rendered by <Summary> from the timeline, not here.)
 */

function KindGlyph({ kind }: { kind: StepKind }) {
  if (kind === 'command') {
    return (
      <span className={`${styles.glyph} ${styles.glyphCommand}`} aria-hidden="true">
        $
      </span>
    );
  }
  if (kind === 'summary') {
    return (
      <span className={`${styles.glyph} ${styles.glyphSummary}`} aria-hidden="true">
        ❯
      </span>
    );
  }
  if (kind === 'edit') {
    return (
      <span className={styles.glyph} aria-hidden="true">
        <svg
          className={styles.glyphIcon}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L5.5 12.5l-2.7.7.7-2.7 7.8-7.8z" />
          <path d="M10.2 3.8l2 2" />
        </svg>
      </span>
    );
  }
  // read — file / eye glyph
  return (
    <span className={styles.glyph} aria-hidden="true">
      <svg
        className={styles.glyphIcon}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1.3 8S3.7 3.5 8 3.5 14.7 8 14.7 8 12.3 12.5 8 12.5 1.3 8 1.3 8z" />
        <circle cx="8" cy="8" r="2" />
      </svg>
    </span>
  );
}

function statusTag(status: ActivityStepData['status']): {
  label: string;
  cls: string;
} | null {
  if (status === 'ok') return { label: 'done', cls: styles.stepStatusOk };
  if (status === 'fail') return { label: 'failed', cls: styles.stepStatusFail };
  if (status === 'running')
    return { label: 'running', cls: styles.stepStatusRunning };
  return null;
}

export function ActivityStep({ step }: ActivityStepProps) {
  const isCommand = step.kind === 'command';
  const tag = statusTag(step.status);

  return (
    <div className={styles.step}>
      <KindGlyph kind={step.kind} />
      <div className={styles.stepMain}>
        <div
          className={
            isCommand
              ? `${styles.stepTitle} ${styles.stepTitleMono}`
              : styles.stepTitle
          }
        >
          <span>{step.title}</span>
          {tag && <span className={`${styles.stepStatusTag} ${tag.cls}`}>{tag.label}</span>}
        </div>

        {step.detail && step.detail.length > 0 ? (
          isCommand ? (
            <Terminal lines={step.detail} status={step.status} />
          ) : (
            <ul className={styles.fileList}>
              {step.detail.map((line, i) => (
                <li key={i} className={styles.fileListItem}>
                  {line}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
