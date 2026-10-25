import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {DisplayPacer} from '../state/display-pacer.mjs';
import {createFenceTracker} from '../lib/markdown-stream.mjs';
export function PacedMessage({text,rate,animate,drain=true,children}:{text:string;rate:number|null;animate:boolean;drain?:boolean;children:(text:string)=>ReactNode}){
  const pacer=useRef<DisplayPacer|null>(null);
  if(!pacer.current)pacer.current=new DisplayPacer(text,rate,animate);
  const tracker=useRef<ReturnType<typeof createFenceTracker>|null>(null);
  if(!tracker.current)tracker.current=createFenceTracker();
  const animated=useRef(animate);
  const [visible,setVisible]=useState(pacer.current.visible);
  useEffect(()=>{
    const p=pacer.current!;animated.current ||= animate;
    p.setTarget(text);p.setRate(rate);
    if(!animate && (!drain || !animated.current))p.finish();
    setVisible(p.visible);
    if(rate===null || p.done)return;
    let last=performance.now(),published=last,id=0;
    const loop=(now:number)=>{
      const next=p.tick((now-last)/1000);last=now;
      // Keep Markdown rendering near 30 fps while following the animation clock.
      if(p.done || now-published>=32){setVisible(next);published=now;}
      if(!p.done)id=requestAnimationFrame(loop);
    };
    id=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(id);
  },[text,rate,animate,drain]);
  return <>{children(tracker.current!.stabilize(visible))}</>;
}
