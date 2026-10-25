import {useEffect,useRef,useState} from 'react';
import type {ConnectionMode} from '../../state/useConnection';
import {loadCatalog,readStatus} from './model-catalog';
import type {Catalog,CatalogModel} from './model-catalog';
import {ControlIcon} from '../ControlIcon';
import {responsePresets,responseOptions,activePresetIndex} from './response-mode.mjs';
import type {ResponseOption} from './response-mode.mjs';
import {modelFamilies,familyChoice,familyID,familyName} from './model-families.mjs';
import type {ModelFamily} from './model-families.mjs';
import './model-picker.css';
import './model-switcher.css';
import './slider-styles.css';
import {FiveStepSlider} from './FiveStepSlider';
import {SliderStylePicker} from './SliderStylePicker';
import {readSliderStyle,saveSliderStyle,normalizeSliderStyle,sliderStyleKey,sliderStyleEvent} from './slider-styles.mjs';
import type {SliderStyle} from './slider-styles.mjs';
import {useAnchoredPopup} from '../useAnchoredPopup';
import {useScrollSelectedIntoView} from '../../styles/useScrollSelectedIntoView';


export function ModelSwitcher({effort,presetId,mode,model,busy,onApply,onResponseMode,docked=false}:{docked?:boolean;effort:string;presetId:string;onResponseMode:(selection:ResponseOption)=>Promise<void>;mode:ConnectionMode;model:string;busy:boolean;onApply:(mode:ConnectionMode,model:string)=>void}){
  const [open,setOpen]=useState(docked),[loading,setLoading]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  const [catalog,setCatalog]=useState<Catalog>({models:[],api:null,errors:[]});
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDivElement>(null);
  const [visualStyle,setVisualStyle]=useState<SliderStyle>(()=>readSliderStyle());
  useEffect(()=>{
    const local=(event:Event)=>setVisualStyle(normalizeSliderStyle((event as CustomEvent).detail));
    const stored=(event:StorageEvent)=>{if(event.key===sliderStyleKey || event.key===null)setVisualStyle(readSliderStyle());};
    window.addEventListener(sliderStyleEvent,local);window.addEventListener('storage',stored);
    return()=>{window.removeEventListener(sliderStyleEvent,local);window.removeEventListener('storage',stored);};
  },[]);
  function chooseVisualStyle(value:SliderStyle){
    const next=saveSliderStyle(value);setVisualStyle(next);
    window.dispatchEvent(new CustomEvent(sliderStyleEvent,{detail:next}));
  }
  const responseRange=useRef<HTMLInputElement>(null);
  const [panel,setPanel]=useState<'models'|'response'>('models');
  const [speedDraft,setSpeedDraft]=useState(2);
  const speedTrigger=useRef<HTMLButtonElement>(null);
  const popupPosition=useAnchoredPopup(open && !docked,panel==='response'?speedTrigger:trigger,dialog,{width:panel==='response'?290:380,align:'end',gap:9});
  useScrollSelectedIntoView(open && panel==='models',dialog.current,`${loading?'loading':catalog.models.map(item=>item.id).join('|')}:${model}`);
  const focusTrigger=()=>{(panel==='response'?speedTrigger:trigger).current?.focus();};
  const locked=busy || pending;
  const pendingRef=useRef(pending);pendingRef.current=pending;
  useEffect(()=>{if(busy && !docked)setOpen(false);},[busy,docked]);
  useEffect(()=>{
    if(!open)return;
    let disposed=false;setLoading(true);setError('');
    void loadCatalog().then(value=>{if(!disposed)setCatalog(value);}).catch(()=>{if(!disposed)setError('模型目录读取失败，请重试。');}).finally(()=>{if(!disposed)setLoading(false);});
    const outside=(event:PointerEvent)=>{if(!docked && !root.current?.contains(event.target as Node) && !pendingRef.current)setOpen(false);};
    const keyboard=(event:KeyboardEvent)=>{
      if(!docked && event.key==='Escape' && !pendingRef.current){event.preventDefault();if(!docked)setOpen(false);focusTrigger();}
      if(!docked && event.key==='Tab'){
        const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)');
        if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keyboard);
    return()=>{disposed=true;document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);};
  },[open,panel,docked,mode,model]);
  useEffect(()=>{if(open && panel==='response' && !loading && !locked)responseRange.current?.focus();},[open,panel,loading,locked]);
  useEffect(()=>{
    if(open && panel==='models' && !loading && !locked){
      const target=dialog.current?.querySelector<HTMLButtonElement>('.smp-simple-model[aria-current="true"]:not(:disabled),.smp-simple-model:not(:disabled)');
      target?.focus({preventScroll:true});
    }
  },[open,panel,loading,locked]);
  async function apply(item:CatalogModel,route:ConnectionMode){
    if(locked || pendingRef.current)return;pendingRef.current=true;setPending(true);setError('');
    try{
      // Re-read before committing: the external route or credentials may have changed since opening.
      const latest=await loadCatalog(),choice=latest.models.find(entry=>entry.id===item.id);
      if(!choice?.routes.some(entry=>entry.id===route && entry.configured))throw new Error('此模型的连接已变化，请检查设置后重试。');
      if(route==='direct'){
        const config=latest.api;
        if(!config?.configured)throw new Error('请先在设置中保存 API 连接。');
        if(config.model!==item.id){
          const response=await fetch('/api/connection/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseUrl:config.baseUrl,model:item.id,protocol:config.protocol})}),value=await response.json();
          if(!response.ok)throw new Error(value.error || '保存模型失败');
        }
      }
      if(route==='opencode'){
        const account=await readStatus<{connected:boolean;models:{id:string}[]}>('/api/connection/account/status');
        if(!account.connected || !account.models.some(entry=>entry.id===item.id))throw new Error('ChatGPT 授权或模型目录已变化。');
      }
      onApply(route,item.id);

      if(!docked)setOpen(false);focusTrigger();
    }catch(reason){setError(reason instanceof Error?reason.message:'切换失败，已保留原选择。');}
    finally{pendingRef.current=false;setPending(false);}
  }
  const filtered=catalog.models.filter(item=>item.routes.some(route=>route.id===mode));
  const families=modelFamilies(filtered);
  const selected=catalog.models.find(item=>item.id===model);
  const variants=selected?.routes.find(route=>route.id===mode)?.variants || [];
  const currentIndex=activePresetIndex(presetId,effort,variants);
  const options=responseOptions(catalog.models,mode,model);
  const preview=options[speedDraft];
  const active=responsePresets[currentIndex];
  useEffect(()=>setSpeedDraft(currentIndex),[currentIndex,model,mode,open]);

  async function chooseResponse(index:number){
    if(locked || pendingRef.current)return;
    setError('');
    const selection=options[index];
    if(!selection?.supported){setSpeedDraft(currentIndex);setError('当前模型或连接没有声明该档位，请选择有刻度的模式。');return;}
    pendingRef.current=true;setPending(true);
    try{
      const latest=await loadCatalog();
      const verified=responseOptions(latest.models,mode,model)[index];
      if(!verified?.supported || verified.model!==selection.model || verified.variant!==selection.variant){
        throw new Error('模型能力已变化，请刷新后重新选择。');
      }
      await onResponseMode(verified);
      if(!docked)setOpen(false);focusTrigger();
    }catch(reason){setError(reason instanceof Error?reason.message:'保存模式失败');setSpeedDraft(currentIndex);}
    finally{pendingRef.current=false;setPending(false);}
  }
  function applyFamily(family:ModelFamily){const item=familyChoice(family,mode,model);if(item)void apply(item,item.routes.find(route=>route.id===mode && route.configured)?.id || item.routes.find(route=>route.configured)!.id);}
  const toggle=(next:'models'|'response')=>{setPanel(next);if(docked)setOpen(true);else setOpen(value=>panel!==next || !value);};
  const sliderEnabled=Boolean(model) && !locked && !loading && options.some(option=>option.supported);

  return <div className={'strip-model-picker strip-live-model-picker smp-simple'+(open?' smp-open':'')+(docked?' smp-docked':'')} ref={root}>
    <button ref={trigger} type="button" className="smp-trigger" aria-label="切换模型" aria-haspopup="dialog" aria-expanded={open && panel==='models'} disabled={locked} onClick={()=>toggle('models')}><span className="smp-trigger-label">{(mode==='direct'?selected?.name || model:familyName(selected?.name || model)) || '选择模型'}</span><ControlIcon name="down" size={12} className={open && panel==='models'?'is-open':''}/></button>
    <button ref={speedTrigger} type="button" className="smp-speed-trigger" aria-label="推理与响应模式" aria-haspopup="dialog" aria-expanded={open && panel==='response'} disabled={!model || locked} onClick={()=>toggle('response')}><ControlIcon name="bolt" size={12}/>{presetId || effort?active?.label:'自动'}<ControlIcon name="down" size={11}/></button>
    {open && <div ref={dialog} className={'smp-popup '+(panel==='response'?'smp-response-menu':'smp-model-menu')} role="dialog" aria-label={panel==='response'?'推理与响应模式':'选择模型'} style={docked?undefined:popupPosition} aria-busy={loading || pending}>
      {panel==='models' && <header className="smp-header"><strong>模型</strong></header>}
      {panel==='models'?<div className="smp-simple-models" aria-label="模型列表">{loading?<p className="smp-no-results" role="status">正在加载模型…</p>:mode==='direct'?filtered.map(item=><button key={item.id} type="button" className="smp-simple-model" aria-current={item.id===model} disabled={locked || !item.routes.some(route=>route.id==='direct' && route.configured)} title={item.id} onClick={()=>void apply(item,'direct')}><span>{item.name}{item.name!==item.id && <small className="smp-model-id">{item.id}</small>}</span>{item.id===model && <ControlIcon name="check" size={15}/>}</button>):families.map(item=><button key={item.id} type="button" className="smp-simple-model" aria-current={item.id===familyID(model)} disabled={locked || !familyChoice(item,mode,model)} title={item.id} onClick={()=>applyFamily(item)}><span>{item.name}</span>{item.id===familyID(model) && <ControlIcon name="check" size={15}/>}</button>)}{!loading && !filtered.length && <p className="smp-no-results">当前连接没有可用模型，请先配置连接。</p>}</div>:<section className="smp-response-panel smp-response-options" data-slider-style={visualStyle} aria-label="推理与响应档位滑动条">
        <FiveStepSlider inputRef={responseRange} visual={visualStyle} value={speedDraft} label="推理与响应模式滑条"
          valueText={(preview?.label || '均衡')+(preview && !preview.supported?'，模型暂不支持':'')}
          disabled={!sliderEnabled} supported={options.map(option=>option.supported)}
          onChange={value=>{setError('');setSpeedDraft(value);}}
          onCommit={value=>void chooseResponse(value)} onCancel={()=>setSpeedDraft(currentIndex)}/>
        <div className="smp-response-steps smp-speed-slider-labels" role="group" aria-label="响应模式档位">
          {options.map((option,index)=><button type="button" key={option.id} aria-pressed={index===currentIndex} disabled={locked || loading || !option.supported} title={option.supported?option.description:'当前模型或渠道不支持'} onClick={()=>void chooseResponse(index)}>
            <span>{option.label}</span>
          </button>)}
        </div>
        <SliderStylePicker style={visualStyle} onChange={chooseVisualStyle}/>
      </section>}
      {(error || catalog.errors.length>0) && <p className="smp-error" role="alert">{error || catalog.errors.join('；')}</p>}
      {pending && <p className={panel==='response'?'smp-slider-sr-only':'smp-simple-note'} role="status">正在切换…</p>}
    </div>}
  </div>;
}


