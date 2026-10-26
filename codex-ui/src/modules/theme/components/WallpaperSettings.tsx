import type {ReactNode} from 'react';
import {ThemePicker} from './ThemePicker';
import {clearImportedTheme} from '../state/generated-theme';
import type {StripAppearance} from '../state/useAppearance';
import type {WallpaperController} from '../state/useWallpaper';
import '../styles/wallpaper-settings.css';

/**
 * Ready-made backgrounds only: each card is fully styled and requires one click.
 * Legacy image uploads remain in local IndexedDB, but are not activated here.
 */
export function WallpaperSettings({theme,onThemeChange,wallpaper:w,children}:{
  theme:StripAppearance;
  onThemeChange:(value:StripAppearance)=>void;
  wallpaper:WallpaperController;
  children?:ReactNode;
}){
  function applyTheme(value:StripAppearance){
    clearImportedTheme();
    w.disableFluidGlass();
    w.disableWallpaper();
    onThemeChange(value);
  }
  function applyGlass(){
    clearImportedTheme();
    w.disableWallpaper();
    w.enableFluidGlass();
  }
  return <section className="strip-connection-card strip-appearance-settings strip-wallpaper-settings" aria-label="页面背景">
    <div className="strip-wallpaper-settings__heading">
      <h2>页面背景</h2>
      <p>选择搭配好的背景即可使用，自动应用到全部页面。</p>
    </div>
    <ThemePicker theme={theme} wallpaperActive={w.fluidGlassEnabled} onChange={applyTheme} customControl={
      <button type="button" className="strip-theme-choice strip-theme-choice--glass"
        data-preview="fluid-glass" aria-label="切换至流体毛玻璃" aria-pressed={w.fluidGlassEnabled}
        onClick={applyGlass}>
        <span className="strip-theme-choice__preview strip-theme-choice__preview--glass" aria-hidden="true">
          <span className="strip-theme-choice__glass-orb strip-theme-choice__glass-orb--a"/>
          <span className="strip-theme-choice__glass-orb strip-theme-choice__glass-orb--b"/>
          <span className="strip-theme-choice__glass-panel"/>
        </span>
        <span className="strip-theme-choice__label">
          <strong>流体毛玻璃</strong>
          <span className="strip-theme-choice__tick" aria-hidden="true">{w.fluidGlassEnabled?'✓':''}</span>
        </span>
      </button>
    }/>
    {children}
  </section>;
}
