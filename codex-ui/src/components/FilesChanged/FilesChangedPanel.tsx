import { useEffect, useState } from 'react';
import type { ChangedFile, TaskStatus } from '../../types';
import { FileTree } from './FileTree';
import { DiffViewer } from './DiffViewer';
import styles from './FilesChanged.module.css';

export interface FilesChangedPanelProps {
  files: ChangedFile[];
  added: number;
  removed: number;
  status: TaskStatus;
}

/** Placeholder content for when there are no files yet, keyed off run status. */
function EmptyState({ status }: { status: TaskStatus }) {
  if (status === 'running') {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyWorking}>
          <span className={styles.workingDot} aria-hidden="true" />
          Working…
        </span>
      </div>
    );
  }
  if (status === 'queued') {
    return (
      <div className={styles.empty}>
        Queued — waiting for an available environment
      </div>
    );
  }
  return <div className={styles.empty}>No changes yet</div>;
}

/**
 * The right panel of Task Detail. A card-styled panel with a "Files changed"
 * header + a mono "+added −removed" summary; the body is the file index
 * (<FileTree>) plus the active file's <DiffViewer>. Active selection is managed
 * locally (defaults to the first file) and stays valid as files stream in.
 */
export function FilesChangedPanel({
  files,
  added,
  removed,
  status,
}: FilesChangedPanelProps) {
  const [activePath, setActivePath] = useState<string>(files[0]?.path ?? '');

  // Keep an active selection as files stream in / change.
  useEffect(() => {
    if (files.length && !files.some((f) => f.path === activePath)) {
      setActivePath(files[0].path);
    }
  }, [files, activePath]);

  const active: ChangedFile | undefined = files.find(
    (f) => f.path === activePath,
  );

  return (
    <section className={styles.panel} aria-label="Files changed">
      <header className={styles.panelHeader}>
        <span className={styles.panelTitle}>Files changed</span>
        {files.length > 0 && (
          <span className={styles.totals}>
            <span className={styles.totalAdded}>{'+' + added}</span>
            <span className={styles.totalRemoved}>{'−' + removed}</span>
          </span>
        )}
      </header>
      {files.length === 0 || !active ? (
        <EmptyState status={status} />
      ) : (
        <div className={styles.body}>
          <FileTree
            files={files}
            activePath={activePath}
            onSelect={setActivePath}
          />
          <DiffViewer file={active} />
        </div>
      )}
    </section>
  );
}
