import type { Suggestion } from '../../types';
import { emptyState } from '../../data';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  suggestions: Suggestion[];
  onPick: (prompt: string) => void;
}

export function EmptyState({ suggestions, onPick }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <div className={styles.logo} aria-hidden="true">
        {'❯_'}
      </div>
      <h1 className={styles.heading}>{emptyState.heading}</h1>
      <p className={styles.subtext}>{emptyState.subtext}</p>
      <div className={styles.chips}>
        {suggestions.map((s) => (
          <button
            key={s.prompt}
            type="button"
            className={styles.chip}
            onClick={() => onPick(s.prompt)}
          >
            <span className={styles.tag}>{s.tag}</span>
            <span className={styles.chipText}>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
