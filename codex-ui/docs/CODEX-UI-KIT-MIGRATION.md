# Codex UI Kit → StripBot 控件替换记录

## 上游来源与许可

- Source: https://github.com/JaminZhou/codex-ui-kit
- Upstream version inspected: `0.1.2`
- License: MIT (Copyright 2026 JaminZhou)
- Vendored subset: `src/vendor/codex-ui-kit/` and its `LICENSE`
- Not bundled: OpenAI official desktop application, trademark assets, proprietary fonts, or the upstream's large unrelated demo/testing tree.

The upstream project is an independent Codex-style UI component library, **not the official Codex Desktop source code**. This migration uses its real open-source component implementations, not just imitation CSS.

## Replaced surfaces

| StripBot element | UI Kit component | Kept StripBot behavior |
|---|---|---|
| Shared action controls in MCP and project pages | `Button` through `StripButton` adapter | onClick, onSubmit, disabled, loading, existing CSS hook classes |
| Sidebar rail and shared icon controls | `IconButton` through `StripIconButton` adapter | DOM refs for popovers, active state, keyboard navigation and shortcuts |
| Tools sidebar category buttons | `Button` with `pressed` | switch between local tools, GitHub, MCP, AstrBot and marketplace |
| Plugin refresh / filtered views / execute action | `IconButton`, `Button` | fetch status, filter plugins, confirm and execute actions |
| Plugin marketplace | `Button` | subscribe, unsubscribe and open MCP settings |
| Confirmation actions | `Button` | native modal confirmation and existing approval safety rules |
| User/assistant chat bubbles | `AgentMessage` | streaming markdown, copy source, stop status and history |
| Execution status disclosure | `AgentActivity`, `StatusIndicator` | linear event order, per-step expansion, command output, diff details and approval queue |
| Plan detail | `AgentPlan` | original task titles and completion state mapping |
| Composer outer layout | `ComposerDock` | original input editor, attachments, model/reasoning controls, stop/queue and send logic |

The customized `StripCodexComposer` editor is intentionally retained **inside** the Kit dock: replacing it with the upstream stock editor without adapting its model and task queue semantics would break existing functionality.

## Integration boundaries

The adapters preserve `StripButton` and `StripIconButton` APIs, so feature pages do not need to know which UI library renders it. Styles in `kit-theme.css` read StripBot's existing light/dark/transparent theme variables; no font download or runtime external assets.

Changes are frontend-only. No agent tool approvals, command execution, plugin isolation, MCP credentials, filesystem permissions, server endpoints or billing rules are modified.

## Verification

1. Run `cd codex-ui && npm ci && npm run build` to typecheck and build the UI.
2. Run the existing Node tests from repository root.
3. Review UI in light and dark themes; confirm small-screen tool tab wrapping, sidebar toggles, message streaming, step expand/collapse, plan step status, composer send/stop and the approval dialog.
4. If needed, revert the UI Kit component imports and adapter. Existing business logic was not removed.

GitHub Actions runs `npm run build` for the UI. The exact installed desktop version must be rebuilt or upgraded before these modifications become visible.
