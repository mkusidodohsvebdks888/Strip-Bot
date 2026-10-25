# Strip Bot Alpha Eye — Shared Scheduler Merge

## Result

The rewrites supplied as `AlphaEye.tsx` and `AlphaEye.css` are integrated.

The component keeps the project's existing props while also accepting the supplied `src`/`alt` API:

```tsx
<AlphaEye label="Strip Bot" />
<AlphaEye label="" />
<AlphaEye src="/custom.jpg" alt="Alpha" />
```

## Fixes integrated

1. Blink restoration now reads the current hover state.
2. Geometry is measured from the untransformed root, never the tilted stage.
3. All instances share one pointer listener and one RAF scheduler.
4. Reduced-motion changes are handled at runtime.
5. CSS and SVG use matching `1:1` cover geometry.

## Additional hardening

- Random blink and idle timers restart after reduced motion is turned off. The supplied version stopped those timers but only called `wake()` when motion was restored.
- Root geometry is cached and refreshed only after pointer changes, resize, or scroll rather than forcing a layout read every frame.
- Hover is also derived from pointer bounds, so 3D tilt does not depend solely on a `pointerenter` event.
- Blink sequences use a generation token so random and click blinks cannot overwrite each other.
- SVG definition IDs remain instance-unique through `useId()`.
- The root and stage remain `span` elements, keeping the rail brand valid inside its parent button.
- Decorative rail/login marks stay hidden from assistive technology; the homepage remains an accessible `img="Strip Bot"` mark.

## File layout

- Component: `codex-ui/src/components/Brand/AlphaEye.tsx`
- Component styles: `codex-ui/src/components/Brand/AlphaEye.css`
- Original image: `codex-ui/src/assets/alpha-eye.jpg`
- Deprecated old stylesheet: `codex-ui/src/styles/alpha-eye.css`

## Browser verification

- Pupil moved from `translate(-3.72 -5.06)` to `translate(8.84 9.01)`.
- Tilt changed from `rotateX(2.4deg) rotateY(-2.4deg)` to `rotateX(-1.37deg) rotateY(1.95deg)`.
- Hover eyelid moved to approximately `233.30`.
- Click followed by immediate pointer leave restored the eyelid to approximately `200.00`.
- Reduced motion reset the pupil to `translate(0.00 0.00)` and cleared tilt.
- Turning reduced motion off restored tilt and pupil movement.
- Rail icon remained `26 × 26` at the same coordinates.

## Verification summary

- TypeScript typecheck: passed
- ESLint: passed
- Full test suite: **230/230 passed**
- Vite production build: passed

## Preview files

- `output/playwright/alpha-eye-shared-login-20261020.png`
- `output/playwright/alpha-eye-shared-home-20261020.png`
- `output/playwright/alpha-eye-shared-rail-20261020.png`

## Windows release

- Release: `desktop-app/releases/alpha-eye-shared-20261020/Strip Bot-win32-x64`
- Packaged startup screenshot: `exports/alpha-eye-shared-packaged-20261020.png`
- Isolated packaged verification: passed
- Bundled OpenCode: `v2.1.1`
- Desktop shortcut now targets the new release.
- Shortcut backup: `E:\Desktop\Desktop\Strip Bot.pre-alpha-eye-shared-20261020.lnk.bak`
