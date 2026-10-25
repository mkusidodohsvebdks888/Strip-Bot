import type {CSSProperties,Ref} from 'react';
import type {SliderStyle} from './slider-styles.mjs';
import {EnergySlider} from './EnergySlider';

const keys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown']);
const steps=[0,1,2,3,4] as const;

/** A native, keyboard-accessible range input with five interchangeable visuals.
 * The parent owns all values and decides whether a setting is supported. */
export function FiveStepSlider({
  visual,value,label,valueText,disabled=false,supported=[true,true,true,true,true],onChange,onCommit,onCancel,inputRef,
}:{
  visual:SliderStyle;
  value:number;
  label:string;
  valueText:string;
  disabled?:boolean;
  supported?:readonly boolean[];
  onChange:(step:number)=>void;
  onCommit?:(step:number)=>void;
  onCancel?:()=>void;
  inputRef?:Ref<HTMLInputElement>;
}){
  if(visual==='energy')return <EnergySlider value={value} label={label} valueText={valueText} disabled={disabled} supported={supported} onChange={onChange} onCommit={onCommit} onCancel={onCancel} inputRef={inputRef}/>;
  const safeValue=Math.max(0,Math.min(4,Math.round(value)));
  const cssVars={'--strip-slider-progress':`${safeValue*25}%`} as CSSProperties;
  return <div className={'strip-five-step-slider strip-five-step-slider--'+visual} data-slider-style={visual} style={cssVars}>
    <div className="strip-five-step-slider__rail" aria-hidden="true">
      <div className="strip-five-step-slider__fill"/>
      {steps.map(step=><span key={step} className={'strip-five-step-slider__tick'+(step<=safeValue?' is-filled':'')+(step===safeValue?' is-current':'')+(supported[step]?'':' is-unsupported')} style={{left:`${step*25}%`,'--i':step} as CSSProperties}/>)}
    </div>
    <input ref={inputRef} type="range" min={0} max={4} step={1} value={safeValue} aria-label={label} aria-valuetext={valueText}
      onKeyDown={event=>{if(event.key==='Enter')event.preventDefault();}}
      disabled={disabled} onChange={event=>onChange(Number(event.target.value))}
      onPointerUp={event=>onCommit?.(Number(event.currentTarget.value))}
      onPointerCancel={onCancel}
      onKeyUp={event=>{if(keys.has(event.key))onCommit?.(Number(event.currentTarget.value));}}
    />
  </div>;
}
