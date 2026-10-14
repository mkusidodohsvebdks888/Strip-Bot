import type { ActivityStep, ChangedFile, RawDiffLine, Task } from '../types';
import { buildReply } from '../data';

/**
 * Seeded tasks + run templates. The 5 existing sidebar items become Tasks; the
 * showcase `add-debounce` task reuses the existing debounce assets (the 10-line
 * `src/utils/debounce.ts` snippet + the `src/components/SearchBar.tsx` +4/−1
 * diff already encoded in `buildReply`).
 *
 * `buildRun(prompt)` produces a believable scripted run for newly created
 * tasks. `RUN_TEMPLATE` describes the activity/diff a run reveals over time;
 * the run engine consumes it.
 */

let runSeq = 0;
function sid(prefix: string): string {
  runSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${runSeq}`;
}

// Monotonic counter for task-id uniqueness (two submissions of the same prompt
// within the same millisecond must not collide).
let slugSeq = 0;

/* ---------- add-debounce (done; reuses existing debounce assets) ---------- */

const reply = buildReply();

// The 10 code lines become `+` adds for the new file's diff.
const debounceAdds: RawDiffLine[] = reply.codeLines.map((text) => ({
  sign: '+',
  text,
  type: 'add',
}));

const debounceFile: ChangedFile = {
  path: reply.fileName, // 'src/utils/debounce.ts'
  status: 'added',
  added: reply.codeLines.length, // 10
  removed: 0,
  lines: debounceAdds,
};

const searchBarFile: ChangedFile = {
  path: reply.diffFile, // 'src/components/SearchBar.tsx'
  status: 'modified',
  added: reply.added, // 4
  removed: reply.removed, // 1
  lines: reply.diffLines ?? [],
};

const addDebounceActivity: ActivityStep[] = [
  {
    id: 'ad-1',
    kind: 'read',
    title: 'Read repository',
    detail: [
      'src/components/SearchBar.tsx',
      'src/utils/',
      'package.json',
    ],
    status: 'ok',
  },
  {
    id: 'ad-2',
    kind: 'command',
    title: '$ rg "onSearch" src',
    detail: [
      'src/components/SearchBar.tsx:14:  const onSearch = (q: string) => query(q);',
      'src/components/SearchBar.tsx:27:      <input onChange={(e) => onSearch(e.target.value)} />',
      '',
      '2 matches across 1 file',
    ],
    status: 'ok',
  },
  {
    id: 'ad-3',
    kind: 'edit',
    title: 'Created src/utils/debounce.ts',
    detail: ['src/utils/debounce.ts  +10'],
    status: 'ok',
  },
  {
    id: 'ad-4',
    kind: 'edit',
    title: 'Edited src/components/SearchBar.tsx',
    detail: ['src/components/SearchBar.tsx  +4 −1'],
    status: 'ok',
  },
  {
    id: 'ad-5',
    kind: 'command',
    title: '$ npm test -- search',
    detail: [
      '> codex-web@1.0.0 test',
      '> vitest run search',
      '',
      ' ✓ src/components/SearchBar.test.tsx (12)',
      '',
      ' Test Files  1 passed (1)',
      '      Tests  12 passed (12)',
    ],
    status: 'ok',
  },
  {
    id: 'ad-6',
    kind: 'summary',
    title: 'Summary',
    status: 'ok',
    text: reply.text,
  },
];

/* ---------- fix-flaky-checkout (running; partial diff, animates) ---------- */

const checkoutFile: ChangedFile = {
  path: 'tests/checkout.integration.test.ts',
  status: 'modified',
  added: 6,
  removed: 3,
  lines: [
    { sign: ' ', text: "  it('completes checkout with a saved card', async () => {", type: 'ctx' },
    { sign: '-', text: '    await clickPay();', type: 'del' },
    { sign: '-', text: '    expect(screen.getByText(/success/i)).toBeVisible();', type: 'del' },
    { sign: '-', text: '  });', type: 'del' },
    { sign: '+', text: '    await clickPay();', type: 'add' },
    { sign: '+', text: '    await waitFor(() =>', type: 'add' },
    { sign: '+', text: '      expect(screen.getByText(/success/i)).toBeVisible(),', type: 'add' },
    { sign: '+', text: '    );', type: 'add' },
    { sign: ' ', text: '', type: 'ctx' },
    { sign: '+', text: '    expect(mockGateway.calls).toHaveLength(1);', type: 'add' },
    { sign: '+', text: '  });', type: 'add' },
  ],
};

const fixFlakyActivity: ActivityStep[] = [
  {
    id: 'fc-1',
    kind: 'read',
    title: 'Read repository',
    detail: [
      'tests/checkout.integration.test.ts',
      'src/checkout/PaymentForm.tsx',
      'src/checkout/gateway.ts',
    ],
    status: 'ok',
  },
  {
    id: 'fc-2',
    kind: 'command',
    title: '$ npm test -- checkout --runInBand',
    detail: [
      '> vitest run checkout',
      '',
      ' ✓ loads the checkout form (84ms)',
      ' ✗ completes checkout with a saved card (timeout)',
      '',
      ' Tests  1 failed | 1 passed (2)',
    ],
    status: 'fail',
  },
  {
    id: 'fc-3',
    kind: 'read',
    title: 'Inspecting the failing assertion',
    detail: [
      'tests/checkout.integration.test.ts:41',
      'race: assertion runs before the gateway promise resolves',
    ],
    status: 'ok',
  },
  {
    id: 'fc-4',
    kind: 'edit',
    title: 'Editing tests/checkout.integration.test.ts',
    detail: ['wrap the success assertion in waitFor(); assert the gateway call'],
    status: 'running',
  },
];

/* ---------- seeded tasks ---------- */

export const seededTasks: Task[] = [
  {
    id: 'add-debounce',
    title: 'Add debounce util to search input',
    repo: 'codex-web',
    branch: 'main',
    group: 'Today',
    prompt: 'Add a debounce util and wire it into the search input',
    status: 'done',
    activity: addDebounceActivity,
    files: [debounceFile, searchBarFile],
    summary: reply.text,
  },
  {
    id: 'fix-flaky-checkout',
    title: 'Fix flaky checkout integration test',
    repo: 'codex-web',
    branch: 'main',
    group: 'Today',
    prompt: 'Find and fix the flaky checkout test',
    status: 'running',
    activity: fixFlakyActivity,
    files: [checkoutFile],
    summary:
      'The checkout integration test asserts the success banner synchronously, but the payment gateway resolves on the next tick — so it flakes under load. Wrapping the assertion in `waitFor` and asserting the gateway was called exactly once makes it deterministic.',
  },
  {
    id: 'migrate-ts',
    title: 'Migrate config to TypeScript',
    repo: 'infra-tools',
    branch: 'main',
    group: 'Yesterday',
    prompt: 'Migrate the build config to TypeScript',
    status: 'queued',
    activity: [],
    files: [],
    summary: 'Queued — waiting for an available environment.',
  },
  {
    id: 'refactor-auth',
    title: 'Refactor auth module',
    repo: 'codex-web',
    branch: 'main',
    group: 'Yesterday',
    prompt: 'Refactor the auth module to use async/await',
    status: 'queued',
    activity: [],
    files: [],
    summary: 'Queued — waiting for an available environment.',
  },
  {
    id: 'otel-traces',
    title: 'Add OpenTelemetry traces',
    repo: 'gateway',
    branch: 'main',
    group: 'Yesterday',
    prompt: 'Add OpenTelemetry traces to the request pipeline',
    status: 'queued',
    activity: [],
    files: [],
    summary: 'Queued — waiting for an available environment.',
  },
];

/* ---------- run template + buildRun ---------- */

/**
 * A RunTemplate is the ordered material the run engine reveals over time. Each
 * activity step is appended in order; the `revealFiles` set maps a step id to
 * the files that should appear in Files changed once that step lands. The
 * final `summary` step streams the summary text token-by-token.
 */
export interface RunTemplate {
  activity: ActivityStep[];
  files: ChangedFile[];
  summary: string;
  /** step id -> file paths revealed when that step completes */
  revealFiles: Record<string, string[]>;
}

/** Derive a short, slug-y task title from a free-text prompt. */
export function titleFromPrompt(prompt: string): string {
  const t = prompt.trim().replace(/\s+/g, ' ');
  const clipped = t.length > 64 ? t.slice(0, 61).trimEnd() + '…' : t;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

/** Slugify a prompt into a unique task id. */
export function slugFromPrompt(prompt: string): string {
  const base = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 5)
    .join('-');
  slugSeq += 1;
  // Date suffix keeps ids readable; the monotonic counter guarantees uniqueness
  // even for identical prompts submitted within the same millisecond.
  return `${base || 'task'}-${Date.now().toString(36)}-${slugSeq}`;
}

/**
 * Produce a believable scripted run for an arbitrary prompt: read repo → a
 * command → edit a file → summary referencing the prompt, with a small canned
 * diff. The activity steps carry no `status` yet — the run engine assigns
 * 'running' then 'ok' as it reveals them.
 */
export function buildRun(prompt: string): RunTemplate {
  const readId = sid('s');
  const cmdId = sid('s');
  const editId = sid('s');
  const summaryId = sid('s');

  const targetPath = 'src/feature/index.ts';

  const file: ChangedFile = {
    path: targetPath,
    status: 'modified',
    added: 5,
    removed: 1,
    lines: [
      { sign: ' ', text: "import { config } from '../config';", type: 'ctx' },
      { sign: '+', text: "import { logger } from '../logger';", type: 'add' },
      { sign: ' ', text: '', type: 'ctx' },
      { sign: '-', text: 'export function run() {', type: 'del' },
      { sign: '+', text: 'export function run(opts: RunOptions = {}) {', type: 'add' },
      { sign: '+', text: '  logger.debug("run", opts);', type: 'add' },
      { sign: '+', text: '  const merged = { ...config, ...opts };', type: 'add' },
      { sign: '+', text: '  return execute(merged);', type: 'add' },
    ],
  };

  const activity: ActivityStep[] = [
    {
      id: readId,
      kind: 'read',
      title: 'Read repository',
      detail: ['src/feature/index.ts', 'src/config.ts', 'package.json'],
    },
    {
      id: cmdId,
      kind: 'command',
      title: '$ rg --files-with-matches "export function run" src',
      detail: ['src/feature/index.ts', '', '1 file'],
    },
    {
      id: editId,
      kind: 'edit',
      title: `Edited ${targetPath}`,
      detail: [`${targetPath}  +${file.added} −${file.removed}`],
    },
    {
      id: summaryId,
      kind: 'summary',
      title: 'Summary',
    },
  ];

  const summary = `Done. I scoped the change for "${prompt.trim()}", updated \`${targetPath}\` to thread options through and add a debug log, and kept the existing behavior intact. Review the diff and run the suite before merging.`;

  return {
    activity,
    files: [file],
    summary,
    revealFiles: { [editId]: [targetPath] },
  };
}

/**
 * Build the RunTemplate that animates the in-progress `fix-flaky-checkout`
 * seeded task from where it is, on open. The first 3 steps are already 'ok';
 * the engine continues from the running edit step → command → summary.
 */
export function buildFlakyCheckoutContinuation(): RunTemplate {
  const cmdId = 'fc-5';
  const summaryId = 'fc-6';

  const activity: ActivityStep[] = [
    {
      id: cmdId,
      kind: 'command',
      title: '$ npm test -- checkout --runInBand',
      detail: [
        '> vitest run checkout',
        '',
        ' ✓ loads the checkout form (81ms)',
        ' ✓ completes checkout with a saved card (143ms)',
        '',
        ' Tests  2 passed (2)',
      ],
    },
    {
      id: summaryId,
      kind: 'summary',
      title: 'Summary',
    },
  ];

  return {
    activity,
    files: [], // checkout file already present; engine just confirms it
    summary:
      'Fixed. The success assertion now waits for the gateway promise via `waitFor`, and I added an explicit assertion that the gateway is called exactly once. Ran the integration suite 20× locally with no failures.',
    revealFiles: {},
  };
}

/**
 * Build the mini-run a follow-up appends: read → edit → summary, updating Files
 * changed with one small additional diff that references the follow-up text.
 */
export function buildFollowUpRun(text: string): RunTemplate {
  const readId = sid('f');
  const editId = sid('f');
  const summaryId = sid('f');

  const path = 'README.md';
  const file: ChangedFile = {
    path,
    status: 'modified',
    added: 3,
    removed: 0,
    lines: [
      { sign: ' ', text: '## Usage', type: 'ctx' },
      { sign: '+', text: '', type: 'add' },
      { sign: '+', text: '> Updated per follow-up request.', type: 'add' },
      { sign: '+', text: 'See the inline docs for the new options.', type: 'add' },
    ],
  };

  const activity: ActivityStep[] = [
    {
      id: readId,
      kind: 'read',
      title: `Follow-up: ${titleFromPrompt(text)}`,
      detail: ['Re-reading the touched files for context'],
    },
    {
      id: editId,
      kind: 'edit',
      title: `Edited ${path}`,
      detail: [`${path}  +${file.added} −${file.removed}`],
    },
    {
      id: summaryId,
      kind: 'summary',
      title: 'Summary',
    },
  ];

  return {
    activity,
    files: [file],
    summary: `Handled the follow-up: ${text.trim()}. Updated \`${path}\` and re-checked the surrounding code.`,
    revealFiles: { [editId]: [path] },
  };
}
