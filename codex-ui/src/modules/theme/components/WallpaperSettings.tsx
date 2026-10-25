import {useRef} from 'react';
import type {ReactNode} from 'react';
import {ThemePicker} from './ThemePicker';
import {clearImportedTheme} from '../state/generated-theme';
import {THEME_CHOICES,type StripAppearance} from '../state/useAppearance';
import type {WallpaperController} from '../state/useWallpaper';
import '../styles/wallpaper-settings.css';

export function WallpaperSettings({theme,onThemeChange,wallpaper:w,children}:{theme:StripAppearance;onThemeChange:(value:StripAppearance)=>void;wallpaper:WallpaperController;children?:ReactNode}){
  const input=useRef<HTMLInputElement>(null);
  const active=w.wallpaperEnabled && Boolean(w.wallpaper);
  const choose=()=>input.current?.click();
  return <section className="strip-connection-card strip-appearance-settings strip-wallpaper-settings" aria-label="外观设置">
    <h2>外观主题</h2><p>点击立即切换，自动记住你的选择。图片仅保存到本机。</p>
    <ThemePicker theme={theme} wallpaperActive={active} onChange={value=>{clearImportedTheme();w.disableWallpaper();onThemeChange(value);}} customControl={
      <button type="button" className="strip-theme-choice strip-theme-custom" aria-pressed={active} disabled={w.busy || w.wallpaperLoading} onClick={()=>w.wallpaper?w.enableWallpaper():choose()}>
        <span className="strip-theme-choice__preview" aria-hidden="true">{w.wallpaper?<img src={w.wallpaper.url} alt=""/>:<span>＋ 选择图片</span>}</span>
        <span className="strip-theme-choice__label"><strong>自定义图片</strong><span className="strip-theme-choice__tick" aria-hidden="true">{active?'✓':''}</span></span>
      </button>
    }/>
    <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp" aria-label="选择本地背景图片" disabled={w.busy || w.wallpaperLoading} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void w.uploadWallpaper(file);}}/>
    {w.wallpaper?<div className="strip-wallpaper-editor">
      <p className="strip-wallpaper-filename">{w.wallpaper.name} · {w.wallpaper.width} × {w.wallpaper.height}</p>
      <div className="strip-wallpaper-actions">
        <button type="button" disabled={w.busy} onClick={choose}>更换图片</button>
        <button type="button" disabled={w.busy} onClick={active?w.disableWallpaper:w.enableWallpaper}>{active?'关闭图片':'启用图片'}</button>
        <button type="button" disabled={w.busy} onClick={()=>void w.removeWallpaper()}>删除图片</button>
      </div>
      <fieldset disabled={w.busy} className="strip-wallpaper-controls"><legend>图片设置</legend>
        <label>显示方式<select value={w.fit} onChange={event=>w.setFit(event.target.value==='cover'?'cover':'contain')}><option value="contain">完整显示（不放大小图片）</option><option value="cover">铺满窗口（可能裁剪）</option></select></label>
        <label>空白处填充主题色<select value={theme} onChange={event=>{clearImportedTheme();onThemeChange(event.target.value as StripAppearance);}}>{THEME_CHOICES.map(choice=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
        <label>边缘渐变 · {w.softness}%<input aria-label="边缘渐变" type="range" min="0" max="100" step="5" value={w.softness} onChange={event=>w.setSoftness(Number(event.target.value))}/></label>
        <label>图片显示强度 · {w.opacity}%<input aria-label="图片显示强度" type="range" min="35" max="100" step="5" value={w.opacity} onChange={event=>w.setOpacity(Number(event.target.value))}/></label>
      </fieldset>
    </div>:<p className="strip-wallpaper-note">支持 JPG、PNG、WebP、GIF、AVIF、BMP，最大 30 MB。</p>}
    {w.busy && <p role="status">正在保存图片…</p>}
    {w.error && <p role="alert" className="strip-wallpaper-error">{w.error}</p>}
    {children}
  </section>;
}
