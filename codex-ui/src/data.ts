import type { Message, Suggestion, TaskGroup } from './types';

export const models: string[] = ['gpt-5-codex', 'codex-1', 'o4-mini'];

export const thinkingLabel = 'Reading repository…';

export const header = {
  repo: 'openai/codex-web',
  branch: 'main',
  status: 'Environment ready',
} as const;

export const emptyState = {
  heading: 'What should we build?',
  subtext:
    'Describe a task and Codex will plan, edit, and test across your repository.',
} as const;

export const composer = {
  placeholder: 'Describe a task, ask a question, or paste code…',
  footer: 'Codex can make mistakes. Review changes before applying.',
  footerMono: '↩ send • ⇧↩ newline',
} as const;

export const suggestions: Suggestion[] = [
  {
    tag: '~/',
    text: 'Refactor the auth module to use async/await',
    prompt: 'Refactor the auth module to use async/await',
  },
  {
    tag: '+',
    text: 'Add a debounce util and wire it into search',
    prompt: 'Add a debounce util and wire it into the search input',
  },
  {
    tag: '!',
    text: 'Find and fix the flaky checkout test',
    prompt: 'Find and fix the flaky checkout test',
  },
  {
    tag: '?',
    text: 'Explain how the build pipeline is configured',
    prompt: 'Explain how the build pipeline is configured',
  },
];

export const taskGroups: TaskGroup[] = [
  {
    label: 'Today',
    items: [
      {
        title: 'Add debounce util to search input',
        repo: 'codex-web',
        dot: 'var(--accent)',
        titleColor: 'var(--fg)',
        active: true,
      },
      {
        title: 'Fix flaky checkout integration test',
        repo: 'codex-web',
        dot: 'var(--dot-warning)',
        titleColor: 'var(--title-warning)',
      },
    ],
  },
  {
    label: 'Yesterday',
    items: [
      {
        title: 'Migrate config to TypeScript',
        repo: 'infra-tools',
        dot: 'var(--faint)',
        titleColor: 'var(--muted)',
      },
      {
        title: 'Refactor auth module',
        repo: 'codex-web',
        dot: 'var(--faint)',
        titleColor: 'var(--muted)',
      },
      {
        title: 'Add OpenTelemetry traces',
        repo: 'gateway',
        dot: 'var(--faint)',
        titleColor: 'var(--muted)',
      },
    ],
  },
];

export interface BuildReplyResult {
  text: string;
  fileName: string;
  lang: string;
  codeLines: string[];
  diffFile: string;
  added: number;
  removed: number;
  diffLines: Message['diffLines'];
}

export function buildReply(): BuildReplyResult {
  return {
    text: "Here's a focused approach. I'll add a typed `debounce` helper, wire it into the search input, and add a unit test so we don't regress on the trailing-edge behavior.",
    fileName: 'src/utils/debounce.ts',
    lang: 'typescript',
    codeLines: [
      'export function debounce<T extends (...a: any[]) => void>(',
      '  fn: T,',
      '  wait = 200',
      '): (...args: Parameters<T>) => void {',
      '  let t: ReturnType<typeof setTimeout> | null = null;',
      '  return (...args) => {',
      '    if (t) clearTimeout(t);',
      '    t = setTimeout(() => fn(...args), wait);',
      '  };',
      '}',
    ],
    diffFile: 'src/components/SearchBar.tsx',
    added: 4,
    removed: 1,
    diffLines: [
      { sign: ' ', text: "import { useMemo } from 'react';", type: 'ctx' },
      {
        sign: '+',
        text: "import { debounce } from '@/utils/debounce';",
        type: 'add',
      },
      { sign: ' ', text: '', type: 'ctx' },
      {
        sign: '-',
        text: '  const onSearch = (q: string) => query(q);',
        type: 'del',
      },
      { sign: '+', text: '  const onSearch = useMemo(', type: 'add' },
      {
        sign: '+',
        text: '    () => debounce((q: string) => query(q), 250),',
        type: 'add',
      },
      { sign: '+', text: '    []);', type: 'add' },
    ],
  };
}
