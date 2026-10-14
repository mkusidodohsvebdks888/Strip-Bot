Solar Icons SVG assets (historical, pre-2026-10-13 build only): @solar-icons/static 2.3.2, Bold Duotone.

Original artwork: 480 Design. https://www.figma.com/community/file/1166831539721848736

Distribution: https://github.com/saoudi-h/solar-icons

Artwork licensed CC BY 4.0: https://creativecommons.org/licenses/by/4.0/

Changes: embedded SVG markup, decorative accessibility attributes, inherited UI color and CSS secondary opacity (0.38).

Superseded 2026-10-13: the Strip Bot React UI functional icons were replaced by Lucide (see below). Backups kept: .runtime/before-lucide-icons (UI sources) and .runtime/public-assets-stale-20261013 (superseded build bundles). Note that this CC BY 4.0 notice is still required, because the legacy page script public/app.js is still distributed and still served by server.js at /app.js for backwards compatibility, and that file embeds Solar Bold Duotone artwork.

Lucide functional icons: Lucide Icons (https://lucide.dev, https://github.com/lucide-icons/lucide), ISC license preserved in lucide-ISC.txt. Selected 24x24 stroke SVGs are compiled into codex-ui/src/icons.generated.ts from the manifest codex-ui/icons/manifest.json. Changes: viewBox normalization, stroke color set to currentColor, stroke-width set to 1.5, decorative accessibility attributes added, fixed pixel size removed so CSS controls sizing.

Strip Codex Composer: StripCodexComposer.tsx + strip-codex-composer.css (V3 revision) and StripDropdown.tsx + strip-dropdown.css from the Strip UI Kit V3 (MIT, copyright 2026 Strip UI Kit contributors); licenses preserved in strip-codex-composer-MIT.txt and strip-ui-kit-MIT.txt. Integrated into codex-ui/src/components with optional host props (value/onValueChange/busy/onStop) and a stop icon path added; token values are remapped in codex-ui/src/styles/strip.css. Source archives: .runtime/ui-kit-20261013.

Strip UI Kit (buttons + 48 basic icons): authored as a standalone MIT work, license preserved in strip-ui-kit-MIT.txt. Assets integrated into Strip Bot: codex-ui/public/icons/*.svg (48 mask-ready 24x24 SVGs, 1.8px stroke), codex-ui/src/styles/strip-buttons.css and codex-ui/src/components/StripButton.tsx. Source archive kept at .runtime/ui-kit-20261013. Changes: the published CSS is bundled as-is, and stroke colors are normalised to currentColor when icons are inlined into codex-ui/src/icons.generated.ts.

MingCute supplemental icons: MingCute Icons (https://www.mingcute.com, https://github.com/mingcute-design/mingcute-icons), Apache License 2.0 preserved in mingcute-Apache-2.0.txt. The soft variants (folder-soft, terminal-soft, chat-soft, settings-soft) come from assets/svg/core/regular with the same normalization as Lucide.

Lobe Icons: @lobehub/icons-static-svg 1.95.1. Source: https://github.com/lobehub/lobe-icons . MIT license preserved in lobe-icons-MIT.txt. Selected brand SVG assets are bundled locally in public/model-icons.js; decorative accessibility attributes and a CSS class were added. Brand artwork retains its original fills and gradients.
