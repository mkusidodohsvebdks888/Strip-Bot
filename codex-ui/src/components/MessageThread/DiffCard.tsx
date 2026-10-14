import type { DiffType, RawDiffLine } from '../../types';
import styles from './MessageThread.module.css';

export interface DiffCardProps {
  diffFile: string;
  added: number;
  removed: number;
  diffLines: RawDiffLine[];
}

function lineClass(type: DiffType): string {
  if (type === 'add') return styles.diffLineAdd;
  if (type === 'del') return styles.diffLineDel;
  return styles.diffLineCtx;
}

function signClass(type: DiffType): string {
  if (type === 'add') return styles.diffSignAdd;
  if (type === 'del') return styles.diffSignDel;
  return styles.diffSignCtx;
}

function textClass(type: DiffType): string {
  if (type === 'add') return styles.diffTextAdd;
  if (type === 'del') return styles.diffTextDel;
  return styles.diffTextCtx;
}

export function DiffCard({
  diffFile,
  added,
  removed,
  diffLines,
}: DiffCardProps) {
  return (
    <div className={styles.diffCard}>
      <div className={styles.diffHeader}>
        <span className={styles.fileName}>{diffFile}</span>
        <span className={styles.diffAdded}>{'+' + added}</span>
        <span className={styles.diffRemoved}>{'−' + removed}</span>
        <span className={styles.diffActions}>
          <button type="button" className={styles.applyButton}>
            Apply
          </button>
          <button type="button" className={styles.viewButton}>
            View
          </button>
        </span>
      </div>
      <div className={styles.diffBody}>
        {diffLines.map((d, i) => (
          <div className={`${styles.diffLine} ${lineClass(d.type)}`} key={i}>
            <span className={`${styles.diffSign} ${signClass(d.type)}`}>
              {d.sign}
            </span>
            <span className={`${styles.diffText} ${textClass(d.type)}`}>
              {d.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
