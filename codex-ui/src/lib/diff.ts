import type { ChangedFile, DiffType, RawDiffLine } from '../types';

/**
 * Shared diff-line decoration. The visual treatment (line background, sign
 * color, text color) is keyed off the diff line's `type` (add/del/ctx) and
 * resolved to the design tokens used by the existing DiffCard:
 *   add → --diff-add-bg / --diff-add-fg / --diff-add-sign
 *   del → --diff-del-bg / --diff-del-fg / --diff-del-sign
 *   ctx → transparent  / --muted-2     / --faint
 *
 * Consumers (DiffViewer, and optionally a refactored DiffCard) map these
 * token references either to inline CSS vars or to their own CSS-module
 * class set via `classFor()`.
 */

export interface DiffLineDecoration {
  /** line background (a token reference, e.g. 'var(--diff-add-bg)') */
  bg: string;
  /** sign-column color (token reference) */
  sign: string;
  /** code-text color (token reference) */
  text: string;
}

const DECORATION: Record<DiffType, DiffLineDecoration> = {
  add: {
    bg: 'var(--diff-add-bg)',
    sign: 'var(--diff-add-sign)',
    text: 'var(--diff-add-fg)',
  },
  del: {
    bg: 'var(--diff-del-bg)',
    sign: 'var(--diff-del-sign)',
    text: 'var(--diff-del-fg)',
  },
  ctx: {
    bg: 'transparent',
    sign: 'var(--faint)',
    text: 'var(--muted-2)',
  },
};

/** Token-reference decoration for a diff line type. */
export function decorate(type: DiffType): DiffLineDecoration {
  return DECORATION[type];
}

/**
 * Resolve a diff line type to one entry from a CSS-module class set. Lets a
 * component keep its styling in a `.module.css` while sharing the mapping.
 */
export function classFor<T>(
  type: DiffType,
  classes: Record<DiffType, T>,
): T {
  return classes[type];
}

/** The sign glyph Codex renders for a changed-file status in the file tree. */
export function statusGlyph(status: ChangedFile['status']): string {
  if (status === 'added') return 'A';
  if (status === 'deleted') return 'D';
  return 'M';
}

/** Token-reference color for a changed-file status glyph. */
export function statusColor(status: ChangedFile['status']): string {
  if (status === 'added') return 'var(--diff-add-sign)';
  if (status === 'deleted') return 'var(--diff-del-sign)';
  return 'var(--dot-warning)';
}

/** Sum of `added`/`removed` across a set of changed files. */
export function diffTotals(files: ChangedFile[]): {
  added: number;
  removed: number;
} {
  return files.reduce(
    (acc, f) => ({ added: acc.added + f.added, removed: acc.removed + f.removed }),
    { added: 0, removed: 0 },
  );
}

/** Convenience: count added/removed lines from raw diff lines. */
export function countLines(lines: RawDiffLine[]): {
  added: number;
  removed: number;
} {
  return lines.reduce(
    (acc, l) => ({
      added: acc.added + (l.type === 'add' ? 1 : 0),
      removed: acc.removed + (l.type === 'del' ? 1 : 0),
    }),
    { added: 0, removed: 0 },
  );
}
