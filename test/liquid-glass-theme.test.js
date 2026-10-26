'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = relative => fs.readFileSync(path.join(root,relative),'utf8');

test('liquid-glass-react is bundled with original MIT license and refraction source',()=>{
  const license=read('codex-ui/src/vendor/liquid-glass-react/LICENSE');
  const component=read('codex-ui/src/vendor/liquid-glass-react/index.tsx');
  const images=read('codex-ui/src/vendor/liquid-glass-react/utils.ts');
  assert.match(license,/Copyright 2025 MAX ROVENSKY/);
  assert.match(license,/Permission is hereby granted/);
  assert.match(component,/export default function LiquidGlass/);
  assert.match(component,/feDisplacementMap/);
  assert.match(images,/export const displacementMap/);
  assert.match(component,/ResizeObserver/);
});

test('real refraction layer is strictly opt-in behind the existing input editor',()=>{
  const bridge=read('codex-ui/src/modules/theme/components/GlassComposerSurface.tsx');
  const app=read('codex-ui/src/App.tsx');
  assert.match(bridge,/import LiquidGlass from ['"]\.\.\/\.\.\/\.\.\/vendor\/liquid-glass-react['"]/);
  assert.match(bridge,/if\(!enabled\)return/);
  assert.match(bridge,/<LiquidGlass/);
  assert.match(bridge,/aria-hidden="true"/);
  assert.match(bridge,/pointerEvents:'none'/);
  assert.match(app,/<GlassComposerSurface enabled=\{wallpaper\.fluidGlassEnabled\}>/);
  assert.match(app,/<ComposerDock/);
  assert.match(app,/<StripCodexComposer/);
});

test('glass style does not mask permissions or intercept the composer',()=>{
  const css=read('codex-ui/src/modules/theme/styles/liquid-glass-surface.css');
  const wrapper=read('codex-ui/src/modules/theme/components/WallpaperSettings.tsx');
  assert.match(css,/pointer-events:\s*none/);
  assert.match(css,/strip-liquid-composer__content/);
  assert.match(css,/\[data-fluid-glass="true"\]/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
  assert.match(wrapper,/w\.enableFluidGlass\(\)/);
  assert.match(wrapper,/w\.disableFluidGlass\(\)/);
});

test('original fixed background palette and other presets are untouched',()=>{
  const skin=read('codex-ui/src/modules/theme/state/useAppearance.ts');
  for(const id of ['warm','white','mist','dark','graphite'])assert.match(skin,new RegExp("id:'"+id+"'"));
  const deps=JSON.parse(read('codex-ui/package.json'));
  assert.equal(deps.dependencies['liquid-glass-react'],undefined,'use vendored module instead of untracked npm dependencies');
});
