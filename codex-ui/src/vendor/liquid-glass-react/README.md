# liquid-glass-react (vendored)

Upstream: https://github.com/rdev/liquid-glass-react

Upstream source inspected: `master`, package version `1.1.1`.
Copyright 2025 MAX ROVENSKY. MIT license: see `LICENSE`.

This directory contains copies of the upstream `src/index.tsx`, `src/utils.ts` and `src/shader-utils.ts`.
There are no additional runtime dependencies beyond the React version already used by StripBot. The source is **not Apple's original Liquid Glass implementation**.

StripBot-specific adaptation:
- `index.tsx` adds a `ResizeObserver` next to its existing window resize listener, so the refraction mask follows composer size changes.
- `src/modules/theme/components/GlassComposerSurface.tsx` mounts the original LiquidGlass component only in the selected **流体毛玻璃** preset, as a visual-only layer behind StripBot's existing input/editor.
- Other themed panels use inexpensive CSS translucent surfaces and rounded highlights. The primary task/approval/file controls remain unchanged.
- Reduce-motion and forced-color environments retain safe CSS fallbacks.
- No shaders execute on a remote server. No font downloads or API calls are added.
- All other appearance presets remain unchanged.

Future updates: compare upstream MIT license and API before copying newer code. Keep the source isolated under `src/vendor`, instead of overwriting core input logic. If a device cannot support the SVG backdrop filter, it retains the CSS glass background.

Verification: `cd codex-ui && npm ci && npm run build`, then inspect the active glass preset in Chromium/Electron. Safari and Firefox cannot display the full SVG displacement effect.
