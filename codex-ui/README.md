# Codex UI (`codex-ui`)

A web implementation of the **Codex** coding-assistant UI — dark-themed, built with
**React 18 + TypeScript + Vite + CSS Modules** (routing via `react-router-dom`).

It began as a pixel-faithful reproduction of the **Codex Chat** design (the 264px task sidebar,
repo/branch header, the empty "What should we build?" state with suggestion chips, a syntax-highlighted
code card and diff card, the auto-resizing composer) and now extends it into the **core Codex loop**:
dispatch a task → watch the agent work in a **task run view** → review the multi-file diff → open a PR.

> Backend is simulated: agent runs are scripted and animated (no real execution or network).

## Run

```bash
npm install
npm run dev       # dev server  → http://localhost:5173
npm run build     # type-check + production build → dist/
npm run preview   # serve the production build
npm run typecheck # tsc --noEmit
```

## Configurable design props

The original design exposes three editor props. They are wired to URL query params (no extra UI is
rendered, so the layout stays identical to the design):

| Param     | Values                                                  | Default        | Example |
|-----------|---------------------------------------------------------|----------------|---------|
| `accent`  | `#5ad6a0` · `#7aa2f7` · `#e0894f` · `#c9a0ff`            | `#5ad6a0`      | `/?accent=%237aa2f7` (`%23` = `#`) |
| `sidebar` | `0` / `false` to hide                                   | shown          | `/?sidebar=0` |
| `user`    | any name (first word becomes the message author label)  | `Jordan Ellis` | `/?user=Sam%20Lee` |

The accent color is applied via a single `--accent` CSS variable on the app root, so it cascades to
the logo, chip tags, branch glyph, "Environment ready" dot, active-task dot, streaming caret,
diff `+` counts, Apply button, and the send button.

## Task run view (routes)

A two-route SPA (`HashRouter`):

| Route | View |
|-------|------|
| `/` | **Home** — the empty state + composer; dispatch a task here. |
| `/#/tasks/:taskId` | **Task Detail** — the agent run view. |

The flow:

- On **Home**, type a task (or click a suggestion chip) and press **Enter** → a task is created and you
  land on its detail page.
- **Task Detail** is a two-panel layout: an **Activity** timeline on the left (the agent reading files,
  running `$` commands with streamed terminal output, editing files, and a summary) and **Files changed**
  on the right (a grouped file tree + a multi-file diff viewer).
- The run is **animated**: steps and terminal output stream in, the status pill goes **Running → Done**,
  and the diff fills progressively.
- **Create PR** (when done) mocks PR creation → a toast + a "View PR #N" link.
- The bottom composer sends a **follow-up**, appending a new turn and updating the diff.
- The sidebar lists tasks with **status dots** (done · running · queued · error), highlights the active
  route, and **New task** returns to Home. Seeded tasks (incl. a failing-test → fix run) have full detail.

The model selector cycles `gpt-5-codex → codex-1 → o4-mini`; Enter sends, Shift+Enter inserts a newline.

## Structure

```
src/
  main.tsx                  app entry (HashRouter)
  App.tsx                   shell: TasksProvider + Layout (persistent Sidebar + routed Outlet) + ToastHost
  routes/                   Home · TaskDetail
  store/TasksContext.tsx    tasks state + actions (createTask, followUp, createPR, toast)
  lib/                      runEngine (animated run scheduler) · diff (shared diff decoration)
  hooks/                    useComposer (draft/model/focus) · useCodexChat (legacy chat state)
  data/tasks.ts             seeded tasks + buildRun(prompt) scripted runs
  types.ts                  shared types (Task, ActivityStep, ChangedFile, Message, …)
  styles/                   tokens.css (design tokens) · global.css (reset, scrollbar, keyframes, fonts)
  components/
    Sidebar/ ChatHeader/ EmptyState/ Composer/
    StatusPill/ TaskHeader/ Toast/
    Activity/               ActivityTimeline · ActivityStep · Terminal · Summary
    FilesChanged/           FilesChangedPanel · FileTree · DiffViewer
    MessageThread/          (legacy chat: Message · CodeCard · DiffCard · TypingIndicator)
docs/superpowers/specs/     design spec(s)
```

## Design fidelity

This implementation was verified pixel-for-pixel against the original "Codex Chat" design rendered in a
browser. `.design-reference/verify/` holds the side-by-side screenshots:

| Implementation | Original |
|----------------|----------|
| `impl-empty.png` | `original-empty.png` |
| `impl-reply.png` (code + diff cards) | `original-reply.png` |
| `impl-no-sidebar.png` · `impl-accent-blue.png` (configurable props) | — |

The matched states are pixel-identical apart from font sub-pixel anti-aliasing. The original Claude Design
source files are intentionally not included in this repository.

The task run view is a new design (no original to diff against); `.design-reference/verify2/` holds live
renders used to verify coherence with the design system: `home.png`, `detail-done.png`, `detail-running-seeded.png`,
`detail-new-done.png`, `detail-followup.png`, `detail-pr.png`, `accent-blue.png`.
