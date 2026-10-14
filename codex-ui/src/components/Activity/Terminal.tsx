import styles from './Activity.module.css';

export interface TerminalProps {
  lines: string[];
  status?: 'running' | 'ok' | 'fail';
}

/**
 * Mono terminal block for a command step's output. Matches the CodeCard idiom:
 * a card (border var(--border-08), radius 11, body bg var(--card-bg)) with a
 * thin header bar (var(--head-bg)) and a mono body (12.5px) listing the output
 * lines, plus a ✓ (accent) / ✗ (red) by status (a blinking caret while running).
 */
export function Terminal({ lines, status }: TerminalProps) {
  const statusClass =
    status === 'ok'
      ? styles.terminalStatusOk
      : status === 'fail'
        ? styles.terminalStatusFail
        : styles.terminalStatusRunning;

  const statusGlyph =
    status === 'ok' ? '✓' : status === 'fail' ? '✗' : status === 'running' ? '•' : '';

  const statusLabel =
    status === 'ok'
      ? 'Command succeeded'
      : status === 'fail'
        ? 'Command failed'
        : status === 'running'
          ? 'Command running'
          : undefined;

  const lastIndex = lines.length - 1;

  return (
    <div className={styles.terminal}>
      <div className={styles.terminalHeader}>
        <span className={styles.terminalLabel}>Terminal</span>
        {status && (
          <span
            className={`${styles.terminalStatus} ${statusClass}`}
            role="status"
            aria-label={statusLabel}
          >
            {statusGlyph}
          </span>
        )}
      </div>
      <div className={styles.terminalBody}>
        {lines.map((line, i) => (
          <div key={i} className={styles.terminalLine}>
            {line}
            {status === 'running' && i === lastIndex && (
              <span className={styles.terminalCaret} aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
