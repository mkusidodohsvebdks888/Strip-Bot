import {lazy,Suspense,useEffect,useRef,useState,type ReactNode} from 'react';
import '../styles/liquid-glass-surface.css';

const LiquidGlass=lazy(()=>import('../../../vendor/liquid-glass-react'));

/**
 * Active only for the preset glass theme. The actual editor stays outside
 * the third-party canvas/SVG layer to protect typing, focus and popup hitboxes.
 */
const ACCESSIBILITY_MEDIA=['(prefers-reduced-motion: reduce)','(forced-colors: active)','(prefers-reduced-transparency: reduce)'];
function visualEffectsAllowed(){
  if(typeof window==='undefined'||!window.matchMedia)return false;
  return ACCESSIBILITY_MEDIA.every(query=>!window.matchMedia(query).matches);
}
export function GlassComposerSurface({enabled,children}:{
  enabled:boolean;
  children:ReactNode;
}){
  const [effectsAllowed,setEffectsAllowed]=useState(visualEffectsAllowed);
  const mouseContainer=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!window.matchMedia)return;
    const media=ACCESSIBILITY_MEDIA.map(query=>window.matchMedia(query));
    const update=()=>setEffectsAllowed(visualEffectsAllowed());
    media.forEach(query=>query.addEventListener?.('change',update));
    update();
    return ()=>media.forEach(query=>query.removeEventListener?.('change',update));
  },[]);
  if(!enabled)return <>{children}</>;
  if(!effectsAllowed)return <div className="strip-liquid-composer strip-liquid-composer--fallback"><div className="strip-liquid-composer__content">{children}</div></div>;
  return <div className="strip-liquid-composer" data-liquid-glass-surface="rdev" ref={mouseContainer}>
    <div className="strip-liquid-composer__lens" aria-hidden="true">
      <Suspense fallback={null}>
      <LiquidGlass
        mouseContainer={mouseContainer}
        mode="standard"
        displacementScale={24}
        blurAmount={0.045}
        saturation={130}
        aberrationIntensity={1.1}
        elasticity={0.07}
        cornerRadius={20}
        padding="0"
        style={{position:'absolute',top:'50%',left:'50%',width:'100%',height:'100%',pointerEvents:'none'}}
      >
        <span className="strip-liquid-composer__fill"/>
      </LiquidGlass>
      </Suspense>
    </div>
    <div className="strip-liquid-composer__content">{children}</div>
  </div>;
}
