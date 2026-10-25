# Strip Bot Alpha Eye Brand — 2026-10-20

## Result

The plush Alpha mark from `alpha_eye_interactive.html` is now the in-app brand and the Windows application icon.

- Homepage: interactive Alpha mark with pointer-following pupil, hover squint, click double-blink, idle look-around, and light 3D tilt.
- Left tool rail: the same animated mark at 26 px without changing the button hit area or layout.
- Login screen: the animated mark beside the Strip Bot name at 38 px.
- Windows executable: static multi-size icon generated from the same artwork.

## Source files

- `codex-ui/src/components/Brand/AlphaEye.tsx`
- `codex-ui/src/styles/alpha-eye.css`
- `codex-ui/src/assets/alpha-eye.jpg`
- `scripts/GenerateAlphaBrandAssets.ps1`

## Integration points

- `codex-ui/src/components/EmptyState/HomeWelcome.tsx`
- `codex-ui/src/components/Sidebar/ToolWorkspace.tsx`
- `codex-ui/src/components/ApiEntry.tsx`
- `codex-ui/src/App.tsx`
- `desktop-app/build.cjs`
- `backend/gateway.cjs`

## Generated assets

- `codex-ui/public/brand-logo.png` and `public/brand-logo.png`: 1024 × 1024 transparent-corner PNG.
- `codex-ui/public/login-brand.jpg` and `public/login-brand.jpg`: 1080 × 1080 JPEG fallback.
- `codex-ui/public/strip-bot.ico` and `public/strip-bot.ico`: multi-size ICO (16, 24, 32, 48, 64, 128, 256).

## Verification

- TypeScript typecheck: passed.
- ESLint: passed.
- Full project tests: **229/229 passed**.
- Vite production build: passed.
- Browser interaction check at `http://127.0.0.1:3070`:
  - Pupil moved from `translate(-4.99 -6.61)` to `translate(10.05 10.61)` when the pointer crossed the icon.
  - 3D tilt changed with pointer position.
  - Click blink expanded the top eyelid from about `233.30` to `273.96`, then restored to `233.30`.
  - Rail brand bounding box remained `26 × 26` at the same coordinates while animating.
  - Reduced-motion emulation kept the stage transform empty and static.
- Packaged application started from an isolated profile with Node integration off, context isolation on, and sandbox on.
- Bundled OpenCode version: `v2.1.1`.

## Artifacts

- Release: `desktop-app/releases/alpha-eye-brand-20261020/Strip Bot-win32-x64`
- Login close-up: `output/playwright/alpha-eye-login-20261020.png`
- Homepage close-up: `output/playwright/alpha-eye-home-20261020.png`
- Rail close-up: `output/playwright/alpha-eye-rail-20261020.png`
- Packaged startup screenshot: `exports/alpha-eye-packaged-20261020.png`
- Extracted EXE icon preview: `exports/alpha-eye-packaged-exe-icon-32.png`

## Desktop shortcut

`E:\Desktop\Desktop\Strip Bot.lnk` now targets the new release.

Backup: `E:\Desktop\Desktop\Strip Bot.pre-alpha-eye-20261020.lnk.bak`

