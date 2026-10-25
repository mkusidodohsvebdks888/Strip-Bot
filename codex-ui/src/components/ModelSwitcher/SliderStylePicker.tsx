import {useId,useState} from 'react';
import {ControlIcon} from '../ControlIcon';
import {sliderStyles} from './slider-styles.mjs';
import type {SliderStyle} from './slider-styles.mjs';

/** Reusable local appearance selector, independent of model-provider capability. */
export function SliderStylePicker({style,onChange}:{style:SliderStyle;onChange:(style:SliderStyle)=>void}){
  const [expanded,setExpanded]=useState(false);
  const id=useId();
  const selected=sliderStyles.find(item=>item.id===style);
  return <section className="smp-style-settings" aria-label="Slider style">
    <button type="button" className="smp-style-toggle" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(v=>!v)}>
      <span>Slider style</span><span className="smp-style-selected">{selected?.label}</span><ControlIcon name="down" size={13} className={expanded?'is-open':''}/>
    </button>
    {expanded && <div className="smp-style-grid" id={id} role="group" aria-label="Choose a slider style">
      {sliderStyles.map(item=><button className="smp-style-option" type="button" key={item.id} aria-pressed={style===item.id} title={item.description} onClick={()=>onChange(item.id)}>
        <span className={'smp-style-thumbnail smp-style-thumbnail--'+item.id} aria-hidden="true"><span className="smp-style-thumbnail__track"/><span className="smp-style-thumbnail__thumb"/></span>
        <span className="smp-style-option__name">{item.label}</span>
        {style===item.id && <ControlIcon name="check" size={12}/>}
      </button>)}
    </div>}
    {expanded && <p className="smp-style-hint">Changes the slider look only; model, permission and speed settings stay the same.</p>}
  </section>;
}
