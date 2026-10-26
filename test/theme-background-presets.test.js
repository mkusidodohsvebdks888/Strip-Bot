'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('appearance retains the five original ready-made background palettes', () => {
  const appearance = source('codex-ui/src/modules/theme/state/useAppearance.ts');
  for (const preset of ['white', 'warm', 'mist', 'dark', 'graphite']) {
    assert.match(appearance, new RegExp("id:'" + preset + "'"));
  }
  assert.doesNotMatch(appearance, /useLayoutEffect\(\(\)=>\{restoreImportedTheme\(\)/);
});

test('background gallery has no manual uploads, sliders or raw OpenUI editors', () => {
  const view = source('codex-ui/src/modules/theme/components/WallpaperSettings.tsx');
  assert.match(view, /<ThemePicker\b/);
  assert.match(view, /data-preview="fluid-glass"/);
  assert.match(view, /aria-pressed=\{w\.fluidGlassEnabled\}/);
  assert.doesNotMatch(view, /type="file"|type="range"|uploadWallpaper|setOpacity|setSoftness|setFit/);
});

test('workspace renders only preset background layers and retains existing themes', () => {
  const app = source('codex-ui/src/App.tsx');
  assert.match(app, /appearanceSettings=\{<WallpaperSettings/);
  assert.match(app, /data-fluid-glass=\{wallpaper\.fluidGlassEnabled\}/);
  assert.doesNotMatch(app, /<OpenUIStudio|strip-theme-legacy|strip-wallpaper-layer|data-wallpaper=/);
  assert.doesNotMatch(app, /import '\.\/modules\/theme\/styles\/wallpaper\.css'/);
});

test('migrated wallpaper preferences cannot activate an old uploaded image', () => {
  const store = source('codex-ui/src/modules/theme/state/useWallpaper.ts');
  assert.match(store, /wallpaperEnabled: false,/);
  assert.match(store, /DB_NAME = 'strip-bot-appearance'/);
  assert.match(store, /DB_STORE = 'wallpapers'/);
  assert.match(store, /fluidGlassEnabled: saved\.fluidGlassEnabled === true/);
});
