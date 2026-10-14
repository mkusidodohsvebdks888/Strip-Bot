import styles from './ChatHeader.module.css';

export interface ChatHeaderProps {
  repo?: string;
  branch?: string;
}

export function ChatHeader({
  repo = 'openai/codex-web',
  branch = 'main',
}: ChatHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.repo}>{repo}</span>
        <span className={styles.sep}>/</span>
        <span className={styles.branch}>
          <span className={styles.branchGlyph} aria-hidden="true">
            &#9095;
          </span>{' '}
          {branch}
        </span>
      </div>
      <div className={styles.right}>
        <span className={styles.envPill}>
          <span className={styles.envDot} aria-hidden="true" /> Environment ready
        </span>
        <button type="button" className={styles.refresh} aria-label="Refresh">
          &#8635;
        </button>
      </div>
    </header>
  );
}
