import {THEME_CHOICES,type StripAppearance} from '../state/useAppearance';
import type {ReactNode} from 'react';
import '../styles/theme-picker.css';

type ThemePickerProps={theme:StripAppearance;onChange:(theme:StripAppearance)=>void;customControl?:ReactNode;wallpaperActive?:boolean};

/** A single click selects a palette immediately, without a save/apply button. */
export function ThemePicker({theme,onChange,customControl,wallpaperActive=false}:ThemePickerProps){
  return <div className="strip-theme-grid" role="group" aria-label="选择界面主题">
    {THEME_CHOICES.map(choice=>{
      const selected=!wallpaperActive && theme===choice.id;
      return <button key={choice.id} type="button"
        className="strip-theme-choice"
        data-preview={choice.id}
        aria-pressed={selected}
        aria-label={'切换至'+choice.name}
        title={choice.description}
        onClick={()=>onChange(choice.id)}>
        <span className="strip-theme-choice__preview" aria-hidden="true">
          <span className="strip-theme-choice__rail"/>
          <span className="strip-theme-choice__lines"><i/><i/><i/></span>
          <span className="strip-theme-choice__composer"/>
        </span>
        <span className="strip-theme-choice__label"><strong>{choice.name}</strong>
          <span className="strip-theme-choice__tick" aria-hidden="true">{selected?'✓':''}</span>
        </span>
        <span className="strip-theme-choice__detail">{choice.description}</span>
      </button>;
    })}
    {customControl}
  </div>;
}
