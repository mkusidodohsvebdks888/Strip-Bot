import type { ChangedFile } from '../../types';
import { decorate } from '../../lib/diff';
import styles from './FilesChanged.module.css';

export interface DiffViewerProps {
  file: ChangedFile;
}

/**
 * Renders one changed file's diff in the existing DiffCard body idiom: each
 * line is a flex row (mono 12.5px / line-height 1.65) with a 22px centered sign
 * gutter and pre-formatted text. Row background, sign color and text color come
 * from the shared lib/diff decoration (which resolves to the diff tokens) — no
 * hardcoded colors.
 */
export function DiffViewer({ file }: DiffViewerProps) {
  return (
    <div className={styles.diffViewer}>
      <div className={styles.diffViewerHeader}>
        <span className={styles.diffViewerPath}>{file.path}</span>
        <span className={styles.diffViewerCounts}>
          <span className={styles.countAdded}>{'+' + file.added}</span>
          <span className={styles.countRemoved}>{'−' + file.removed}</span>
        </span>
      </div>
      <div className={styles.diffViewerBody}>
        {file.lines.map((line, i) => {
          const d = decorate(line.type);
          return (
            <div
              key={i}
              className={styles.diffLine}
              style={{ background: d.bg }}
            >
              <span
                className={styles.diffSign}
                style={{ color: d.sign }}
                aria-hidden="true"
              >
                {line.sign}
              </span>
              <span className={styles.diffText} style={{ color: d.text }}>
                {line.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
