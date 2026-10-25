import type {StripAppearance} from '../state/useAppearance';
import {appearanceLabels} from '../state/useAppearance';
import type {AppTheme} from '../state/useAppTheme';

type Props = {theme:AppTheme;onChange:(theme:AppTheme)=>void;appearance?:StripAppearance;onCycle?:()=>void;variant?:'sidebar'|'entry'};

/** Visible, accessible light/dark switch with a stable local preference. */
export function ThemeToggle({theme,onChange,appearance,onCycle,variant='sidebar'}:Props) {
  const isLight=theme==='light';
  const next:AppTheme=isLight?'dark':'light';
  const text=appearance?'切换外观，当前：'+appearanceLabels[appearance]+'（暖白／纯白／深色）':isLight?'切换深色模式':'切换浅色模式';
  return <button
    type="button"
    className={'strip-theme-switch'+(variant==='entry'?' strip-theme-switch--entry':' strip-btn strip-btn--ghost')}
    aria-label={text}
    title={text}
    onClick={()=>onCycle?onCycle():onChange(next)}
  >
    {isLight
      ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20.4 15.7A8.8 8.8 0 0 1 8.3 3.6 8.9 8.9 0 1 0 20.4 15.7Z"/></svg>
      : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>}
    <span>{appearance?appearanceLabels[appearance]:isLight?'深色模式':'浅色模式'}</span>
  </button>;
}
