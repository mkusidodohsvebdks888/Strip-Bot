'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../codex-ui/src');
const oldFiles=[
 ['state/useAppearance.ts','modules/theme/state/useAppearance.ts'],
 ['state/useAppTheme.ts','modules/theme/state/useAppTheme.ts'],
 ['state/useWallpaper.ts','modules/theme/state/useWallpaper.ts'],
 ['components/ThemePicker.tsx','modules/theme/components/ThemePicker.tsx'],
 ['components/ThemeToggle.tsx','modules/theme/components/ThemeToggle.tsx'],
 ['components/WallpaperSettings.tsx','modules/theme/components/WallpaperSettings.tsx']
];
const cssFiles=[
 ['styles/theme.css','modules/theme/styles/theme.css'],
 ['styles/claude-theme.css','modules/theme/styles/claude-theme.css'],
 ['styles/theme-options.css','modules/theme/styles/theme-options.css'],
 ['styles/theme-palettes.css','modules/theme/styles/theme-palettes.css'],
 ['styles/wallpaper.css','modules/theme/styles/wallpaper.css'],
 ['components/theme-picker.css','modules/theme/styles/theme-picker.css'],
 ['components/wallpaper-settings.css','modules/theme/styles/wallpaper-settings.css']
];
test('all theme logic has canonical module sources and backward compatible exports',()=>{
  for(const [legacy,target] of oldFiles){
    const current=fs.readFileSync(path.join(root,legacy),'utf8');
    assert.ok(fs.statSync(path.join(root,target)).isFile(),target);
    assert.match(current,/export \* from/);
    assert.ok(current.includes(path.basename(target).replace(/\.tsx?$/,'')),legacy);
  }
  const entry=fs.readFileSync(path.join(root,'modules/theme/index.ts'),'utf8');
  for(const item of ['useAppearance','useWallpaper','ThemePicker','WallpaperSettings'])assert.ok(entry.includes(item),item);
});
test('theme CSS legacy imports retain source styles and background effects',()=>{
  for(const [legacy,target]of cssFiles){
    const wrapper=fs.readFileSync(path.join(root,legacy),'utf8');
    assert.match(wrapper,/@import/);
    assert.ok(fs.statSync(path.join(root,target)).size>50,target);
  }
});
test('desktop window palette remains compatible',()=>{
  const old=require('../desktop-app/runtime/window-appearance.cjs');
  const direct=require('../desktop-app/runtime/theme/window-appearance.cjs');
  assert.strictEqual(old.getAppearance,direct.getAppearance);
  assert.equal(old.getAppearance('graphite').theme,'dark');
});
