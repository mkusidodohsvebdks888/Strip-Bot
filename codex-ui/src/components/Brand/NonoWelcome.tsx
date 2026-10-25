import {useEffect,useRef,useState} from 'react';
import {nonoLayers} from './nono-layers';
import './nono-welcome.css';
export type NonoInputActivity={serial:number;active:boolean};
/** Original raster layers, animated only by local edits in the home composer. */
export function NonoWelcome({activity}:{activity:NonoInputActivity}){
  const [typing,setTyping]=useState(false);
  const seen=useRef(activity.serial);
  useEffect(()=>{
    if(seen.current===activity.serial)return;
    seen.current=activity.serial;
    if(!activity.active){setTyping(false);return;}
    setTyping(true);
    const timer=window.setTimeout(()=>setTyping(false),650);
    return()=>window.clearTimeout(timer);
  },[activity.serial,activity.active]);
  return <div className={'strip-nono-welcome'+(typing?' is-typing':'')} role="img" aria-label="糯糯" data-typing={typing}>
    <div className="strip-nono-scene"><div className="strip-nono-rig">
      {nonoLayers.map(layer=><img key={layer.id} className={'strip-nono-layer strip-nono-'+layer.id} src={layer.src} alt="" draggable={false} style={{left:layer.left+'%',top:layer.top+'%',width:layer.width+'%',height:layer.height+'%',transformOrigin:layer.origin}}/>)}
    </div></div>
  </div>;
}
