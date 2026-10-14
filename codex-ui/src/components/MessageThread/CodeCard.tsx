import styles from './MessageThread.module.css';

export interface CodeCardProps {
  fileName: string;
  lang: string;
  codeLines: string[];
  copyLabel: string;
  onCopy: () => void;
}

function isComment(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('*')
  );
}

export function CodeCard({
  fileName,
  lang,
  codeLines,
  copyLabel,
  onCopy,
}: CodeCardProps) {
  return (
    <div className={styles.codeCard}>
      <div className={styles.codeHeader}>
        <span className={styles.codeSquare} aria-hidden="true" />
        <span className={styles.fileName}>{fileName}</span>
        <span className={styles.langBadge}>{lang}</span>
        <button
          type="button"
          className={styles.copyButton}
          onClick={onCopy}
        >
          {copyLabel}
        </button>
      </div>
      <div className={styles.codeBody}>
        {codeLines.map((line, i) => (
          <div className={styles.codeLine} key={i}>
            <span className={styles.gutter}>{i + 1}</span>
            <span
              className={
                isComment(line)
                  ? `${styles.codeText} ${styles.codeComment}`
                  : styles.codeText
              }
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
