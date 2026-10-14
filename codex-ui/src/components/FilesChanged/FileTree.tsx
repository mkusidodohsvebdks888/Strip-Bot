import type { ChangedFile } from '../../types';
import { statusColor, statusGlyph } from '../../lib/diff';
import styles from './FilesChanged.module.css';

export interface FileTreeProps {
  files: ChangedFile[];
  activePath: string;
  onSelect: (path: string) => void;
}

function statusLabel(status: ChangedFile['status']): string {
  return status;
}

/** Split a path into its directory ('' for repo root) and base filename. */
function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf('/');
  if (i === -1) return { dir: '', name: path };
  return { dir: path.slice(0, i), name: path.slice(i + 1) };
}

interface DirGroup {
  dir: string;
  files: ChangedFile[];
}

/** Group files by directory, preserving first-seen order. */
function groupByDir(files: ChangedFile[]): DirGroup[] {
  const groups: DirGroup[] = [];
  const index = new Map<string, DirGroup>();
  for (const file of files) {
    const { dir } = splitPath(file.path);
    let group = index.get(dir);
    if (!group) {
      group = { dir, files: [] };
      index.set(dir, group);
      groups.push(group);
    }
    group.files.push(file);
  }
  return groups;
}

/**
 * The file index for Files changed: files grouped by directory with an
 * uppercase directory label (like the sidebar group labels), a colored status
 * glyph, the filename, and a right-aligned mono "+a −r". Selectable rows.
 */
export function FileTree({ files, activePath, onSelect }: FileTreeProps) {
  const groups = groupByDir(files);

  return (
    <ul className={styles.fileTree} aria-label="Files changed">
      {groups.map((group) => (
        <li key={group.dir || '/'} className={styles.group}>
          <div className={styles.groupLabel}>{group.dir || '/'}</div>
          <ul className={styles.groupFiles}>
            {group.files.map((file) => {
              const { name } = splitPath(file.path);
              const isActive = file.path === activePath;
              return (
                <li key={file.path}>
                  <button
                    type="button"
                    className={isActive ? styles.fileRowActive : styles.fileRow}
                    onClick={() => onSelect(file.path)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span
                      className={styles.fileGlyph}
                      style={{ color: statusColor(file.status) }}
                      aria-label={statusLabel(file.status)}
                    >
                      {statusGlyph(file.status)}
                    </span>
                    <span className={styles.fileName}>{name}</span>
                    <span className={styles.fileCounts}>
                      <span className={styles.countAdded}>{'+' + file.added}</span>
                      <span className={styles.countRemoved}>{'−' + file.removed}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
