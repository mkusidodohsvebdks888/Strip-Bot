import type {ReactNode} from 'react';
import LiquidGlass from '../../../vendor/liquid-glass-react';
import '../styles/liquid-glass-surface.css';

/**
 * Active only for the preset glass theme. The actual editor stays outside
 * the third-party canvas/SVG layer to protect typing, focus and popup hitboxes.
 */
export function GlassComposerSurface({enabled,children}:{
  enabled:boolean;
  children:ReactNode;
}){
  if(!enabled)return <>{children}</>;
  return <div className="strip-liquid-composer" data-liquid-glass-surface="rdev">
    <div className="strip-liquid-composer__lens" aria-hidden="true">
      <LiquidGlass
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
    </div>
    <div className="strip-liquid-composer__content">{children}</div>
  </div>;
}
