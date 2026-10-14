# codex-ui — Increment 1: Task Run View (web)

Date: 2026-06-25
Status: Approved (user authorized building all recommended choices without further confirmation)

## Goal

Evolve the current single chat screen into the **defining Codex loop**: dispatch a task → land on a
**Task Detail / run view** where the agent appears to work autonomously (activity timeline with file
reads, terminal commands, edits), producing a **multi-file diff** (Files changed) with a status
lifecycle (running → done) and a **Create PR** action + **follow-up**. This is a web SPA.

There is **no real backend** — the agent run is **scripted/simulated** with realistic, deterministic
data, animated over time (reusing the existing streaming approach).

## Decisions (locked)

- **Navigation:** send-a-task → navigate to that task's detail; sidebar tasks are links and switch
  between detail pages; "New task" → Home (compose). Full list↔detail SPA.
- **Layout:** Task Detail is a **two-panel split** — Activity timeline (left) + Files changed (right).
- **Run simulation:** **dynamic** — steps and terminal output stream in, status flips running→done,
  the diff fills progressively.
- **Router:** `react-router-dom` v6 with **HashRouter** (zero-config deep links for static `vite preview`
  / GitHub Pages). Routes: `/` (Home) and `/tasks/:taskId` (Task Detail). The existing query-param props
  (`accent`/`sidebar`/`user`) keep working via `window.location.search`.
- **State:** a `TasksProvider` React context holds tasks + actions; a small run engine drives the
  animated simulation. Reuse the existing token system and components.

## In scope

- Home (`/`): the existing empty state + composer (compose a new task). Visually preserves the current
  design. Suggestion chips and the composer create a task.
- Task Detail (`/tasks/:id`): two-panel run view (Activity + Files changed), task header with status pill
  + actions, follow-up composer at the bottom.
- Dynamic run animation; status lifecycle; auto-scroll of the activity column.
- Multi-file diff viewer with a file tree/index + per-file diff (reuses diff line rendering).
- Sidebar: status-driven dots, task rows link to detail, active route highlighted, "New task" → Home.
- Create PR (mocked): done → "Create PR" → brief "Creating…" → "View PR #N" (opens a fake URL) + toast.
- Follow-up: appends a user turn + a short scripted run that updates Files changed.
- Seeded tasks: the existing 5 sidebar tasks get real detail data (see Seeded data).

## Out of scope (future increments)

Real repo/branch/environment pickers, Ask vs Code modes, task queueing, settings, real GitHub/PR,
real agent execution, auth. Do not build these now.

## Architecture & files

Keep the existing design system (`src/styles/tokens.css`, `global.css`) and existing presentational
components. Add routing + a tasks store + the new views/components.

```
src/
  main.tsx                      wrap <App/> in <HashRouter>
  App.tsx                       layout shell: persistent <Sidebar/> + <Routes> (Home, TaskDetail);
                                reads accent/sidebar/user props; sets --accent on root (unchanged)
  routes/
    Home.tsx                    empty state + composer; submit -> createTask(prompt) -> navigate(/tasks/:id)
    TaskDetail.tsx              two-panel run view for :taskId (redirect to / if not found)
  store/
    TasksContext.tsx            TasksProvider + useTasks(); holds tasks[], createTask, followUp, createPR,
                                and starts the run engine for a task
  lib/
    runEngine.ts                schedules a task's activity steps + diff reveal over time (timers; reuse
                                the 22+random*26ms streaming feel); cleans up on unmount
    diff.ts                     shared diff-line decoration (add/del/ctx -> classes), used by DiffViewer
  data/
    tasks.ts                    seeded Task[] (the 5 sidebar tasks with full detail) + run templates +
                                buildRun(prompt) for newly created tasks
  types.ts                      extend with Task, ActivityStep, ChangedFile (keep existing types)
  components/
    Sidebar/                    UPDATED: NavLink task rows, status dots from task.status, New task -> '/'
    ChatHeader/                 reused on Home (repo/branch/env-ready) — unchanged
    EmptyState/  Composer/      reused (Composer is reused for follow-up too) — largely unchanged
    StatusPill/                 running (pulsing dot + "Running")/done (✓ "Done")/queued/error
    TaskHeader/                 task detail header: repo/branch + <StatusPill/> + actions (Create PR, ↻)
    Activity/
      ActivityTimeline.tsx      maps task.activity -> steps; auto-scrolls; shows running indicator
      ActivityStep.tsx          one step row (icon by kind, title, optional detail/file list)
      Terminal.tsx              command step body: mono terminal block, streamed output lines, exit state
      Summary.tsx               the agent summary text (supports streaming caret while running)
    FilesChanged/
      FilesChangedPanel.tsx     header "Files changed" + total +N −M; file index + active file diff
      FileTree.tsx              files grouped by directory; +/- per file; status glyph; selectable
      DiffViewer.tsx            renders the selected/expanded file's diff (uses lib/diff + tokens)
    CodeCard/ DiffCard/         keep existing; factor shared diff-line rendering into DiffViewer/diff.ts
    Toast/                      transient toast (e.g. "Pull request created")
```

The old in-page streaming chat (`MessageThread`/`Message`) is **superseded** by the Activity timeline:
on Home you no longer see an in-page reply — submitting navigates to the task detail where the run lives.
`CodeCard`/`DiffCard` styling is reused inside Activity/FilesChanged. Do not delete `MessageThread`
wholesale if reuse is cleaner; factor diff rendering into a shared primitive (`lib/diff.ts` + DiffViewer).

## Data model (extend `src/types.ts`)

```ts
export type TaskStatus = 'queued' | 'running' | 'done' | 'error';

export type StepKind = 'read' | 'command' | 'edit' | 'summary';
export interface ActivityStep {
  id: string;
  kind: StepKind;
  title: string;            // 'Read repository' | '$ npm test -- search' | 'Edited 2 files' | summary intro
  detail?: string[];        // file list, or terminal output lines
  status?: 'running' | 'ok' | 'fail';
}

export interface ChangedFile {
  path: string;             // 'src/utils/debounce.ts'
  status: 'added' | 'modified' | 'deleted';
  added: number;
  removed: number;
  lines: RawDiffLine[];     // reuse existing RawDiffLine
}

export interface Task {
  id: string;               // slug, e.g. 'add-debounce'
  title: string;
  repo: string;             // 'codex-web'
  branch: string;           // 'main'
  group: 'Today' | 'Yesterday';
  prompt: string;
  status: TaskStatus;
  activity: ActivityStep[];
  files: ChangedFile[];
  summary: string;
  prNumber?: number;        // set after Create PR
}
```

Totals: `added`/`removed` for the task = sum across `files`. Status→dot color mapping (keeps the Home
sidebar visually faithful to the original — 1 accent, 1 amber, 3 faint):
- `done` → `var(--accent)`   `running` → `var(--dot-warning)` (#e0b150) + subtle pulse
- `queued` → `var(--faint)`   `error` → `var(--diff-del-sign)` (#e06b6b)

## Behaviors

- **Create task (hero flow):** Home composer/chip → `createTask(prompt)` creates a Task with
  `status:'running'` and a scripted run (from `buildRun(prompt)`), navigates to `/tasks/:id`. The run
  engine streams steps: read repo → run command(s) (terminal output streams line by line) → edit files
  (Files changed panel fills progressively) → summary streams → `status:'done'`. Auto-scroll Activity.
  Reuse the existing timing feel (≈120ms first, 22+random*26ms per token; small inter-step delays).
- **Open seeded task:** navigating to a `done` seeded task renders its completed detail statically. A
  `running` seeded task animates from where it is on open. Keep it simple and leak-free (clear timers on
  unmount / route change / New task).
- **Follow-up:** Composer at the bottom of Task Detail. Sending appends a `read`+`edit`+`summary` mini-run
  and updates Files changed; status briefly running→done.
- **Create PR:** when `done`, TaskHeader shows "Create PR". Click → "Creating…" (brief) → "View PR #N"
  (opens `https://github.com/openai/codex-web/pull/N` in a new tab) + a Toast "Pull request created".
  Mocked only; no network.
- **Enter-to-send / Shift+Enter newline / model cycling / textarea autosize** carry over from the
  existing Composer behavior.

## Seeded data (`src/data/tasks.ts`)

Map the existing 5 sidebar items to tasks. The showcase task `add-debounce` **reuses the existing
debounce assets** (the `src/utils/debounce.ts` 10-line snippet + the `src/components/SearchBar.tsx`
+4/−1 diff already in the codebase).

- `add-debounce` — group Today, status **done**. Title "Add debounce util to search input".
  Activity: Read repository (opened SearchBar.tsx, utils/) → `$ rg "onSearch" src` → Created
  `src/utils/debounce.ts` → Edited `src/components/SearchBar.tsx` → `$ npm test -- search` (12 passed) →
  Summary = the existing reply text. Files: `src/utils/debounce.ts` (added, +10 −0, the 10 code lines as
  `+` adds) and `src/components/SearchBar.tsx` (modified, +4 −1, the existing diff lines).
- `fix-flaky-checkout` — Today, status **running** (amber, pulsing). Title "Fix flaky checkout
  integration test". A believable in-progress run (reading tests, running the flaky test) with a partial
  diff. Animates on open.
- `migrate-ts` — Yesterday, status **queued**. "Migrate config to TypeScript", repo infra-tools.
- `refactor-auth` — Yesterday, status **queued**. "Refactor auth module", repo codex-web.
- `otel-traces` — Yesterday, status **queued**. "Add OpenTelemetry traces", repo gateway.

Queued tasks show a minimal detail ("Queued — waiting for an available environment") with no diff yet.
New tasks created from the composer use `buildRun(prompt)`: a generic but believable scripted run
(read repo → a command → edit a file → summary referencing the prompt) with a small canned diff.
Authoring latitude: make scripted content look real and consistent with the Codex aesthetic.

## Design fidelity & verification

These are **new screens** — there is no ground-truth image. Fidelity means:
1. **Reuse the exact design system** — every color/spacing/font from `tokens.css`; no hardcoded values;
   mono (`--font-mono`) for code/paths/terminal/status, UI font elsewhere; same card/border/radius idiom
   as the existing CodeCard/DiffCard.
2. **Visual coherence + Codex polish** — the new task-detail view must look like it shipped with the
   existing screens and feel like the real Codex app.
3. **Home regression** — Home (empty state + composer + sidebar) must still match the original design
   language (minor, intentional differences allowed: the active-row highlight now follows the route).

Verification (live browser, done in the main session after the build): screenshot Home (regression),
Task Detail **running** and **done** states, follow-up, Create PR + toast, sidebar statuses, and an
accent variant. Plus a static audit for token reuse, a11y (semantic regions, keyboardable controls,
icon-button labels), responsiveness, and timer-leak safety. Iterate until coherent and correct.

## Build approach

A multi-phase Workflow: (1) Foundation — router + tasks store + run engine + types + seeded data +
shared diff primitive; (2) Components (parallel) — Sidebar update, TaskHeader+StatusPill, Activity
(timeline/step/terminal/summary), FilesChanged (panel/tree/diffviewer), Toast, Home+TaskDetail routes;
(3) Integrate & build (`tsc` + `vite build`); (4) Audit (static design-system + interaction lenses);
(5) Fix & finalize. Then live visual verification + polish in the main session.
