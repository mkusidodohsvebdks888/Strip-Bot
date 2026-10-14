export type Role = 'user' | 'assistant';
export type AccentColor = '#5ad6a0' | '#7aa2f7' | '#e0894f' | '#c9a0ff';
export type DiffType = 'add' | 'del' | 'ctx';

export interface RawDiffLine {
  sign: ' ' | '+' | '-';
  text: string;
  type: DiffType;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  model?: string;
  streaming?: boolean;
  showCode?: boolean;
  showDiff?: boolean;
  fileName?: string;
  lang?: string;
  codeLines?: string[];
  diffFile?: string;
  added?: number;
  removed?: number;
  diffLines?: RawDiffLine[];
}

export interface Suggestion {
  tag: string;
  text: string;
  prompt: string;
}

export interface TaskItem {
  title: string;
  repo: string;
  dot: string;
  titleColor: string;
  active?: boolean;
}

export interface TaskGroup {
  label: string;
  items: TaskItem[];
}

/* ---- Task Run View ---- */

export type TaskStatus = 'queued' | 'running' | 'done' | 'error';

export type StepKind = 'read' | 'command' | 'edit' | 'summary';

export interface ActivityStep {
  id: string;
  kind: StepKind;
  title: string; // 'Read repository' | '$ npm test -- search' | 'Edited 2 files' | summary intro
  detail?: string[]; // file list, or terminal output lines
  status?: 'running' | 'ok' | 'fail';
  text?: string; // for `summary` steps: this turn's own summary text (so multiple
  //                summaries from follow-ups each keep their text instead of all
  //                sharing the single mutable task.summary).
}

export interface ChangedFile {
  path: string; // 'src/utils/debounce.ts'
  status: 'added' | 'modified' | 'deleted';
  added: number;
  removed: number;
  lines: RawDiffLine[]; // reuse existing RawDiffLine
}

export interface Task {
  id: string; // slug, e.g. 'add-debounce'
  title: string;
  repo: string; // 'codex-web'
  branch: string; // 'main'
  group: 'Today' | 'Yesterday';
  prompt: string;
  status: TaskStatus;
  activity: ActivityStep[];
  files: ChangedFile[];
  summary: string;
  prNumber?: number; // set after Create PR
}
