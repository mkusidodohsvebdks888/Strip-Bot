# Compact Model Picker — 2026-10-20

## Result

The model selector displays two compact rows and scrolls from the third model onward.

## Actual integration

The current `ModelSwitcher` owns the scroll container `.smp-simple-models`, so the compact height is applied there rather than only to `.smp-popup`.

Changed files:

- `codex-ui/src/styles/model-picker-compact.css`
- `codex-ui/src/styles/useScrollSelectedIntoView.ts`
- `codex-ui/src/components/ModelSwitcher/ModelSwitcher.tsx`
- `codex-ui/src/App.tsx`

## Verified layout

- Popup width: `300px`
- Header height: `30px`
- Model row height: `46px`
- Scroll viewport: `108px` (`2` rows plus gap/padding)
- Five models: scrollable, selected fifth model remains visible
- Two models: no scrolling and no bottom fade
- Response/speed menu: unaffected and independently sized

## Auto-scroll

The hook runs after the asynchronous model catalog finishes loading and when the selected model changes. It scrolls the actual `.smp-simple-models` container rather than the page.

## Verification

- TypeScript: passed
- ESLint: passed
- Full test suite: **233/233 passed**
- Vite production build: passed
- Packaged startup: passed
- OpenCode: `v2.1.1`

## Release

`desktop-app/releases/compact-model-picker-20261020/Strip Bot-win32-x64`

Shortcut backup:

`E:\Desktop\Desktop\Strip Bot.pre-compact-model-picker-20261020.lnk.bak`
