import {useEffect,useId,useRef} from 'react';
import alphaEyeImage from '../../assets/alpha-eye.jpg';
import './AlphaEye.css';

const IMAGE_SIZE=1080;
const CX=393;
const CY=400;
const MAX_X=14;
const MAX_Y=18;
const HOVER_LID=.45;
const TOP_LID_Y=200;
const BOTTOM_LID_Y=474;
const LID_TRAVEL=74;
const PUPIL_EASE=.14;
const LID_EASE=.35;
const TILT_DEG=8;
const SETTLE_EPS=.02;

type Tick=()=>boolean;
const pointer={x:0,y:0,inside:false};
const tickers=new Set<Tick>();
let rafId=0;
let pointerBound=false;

const runLoop=()=>{
  rafId=0;
  let busy=false;
  tickers.forEach(tick=>{if(tick())busy=true;});
  if(busy && tickers.size)rafId=requestAnimationFrame(runLoop);
};
const wake=()=>{if(!rafId && tickers.size)rafId=requestAnimationFrame(runLoop);};
const onPointerMove=(event:PointerEvent)=>{
  pointer.x=event.clientX;
  pointer.y=event.clientY;
  pointer.inside=true;
  wake();
};
const onPointerOut=(event:PointerEvent)=>{
  if(!event.relatedTarget){
    pointer.inside=false;
    wake();
  }
};
const bindPointer=()=>{
  if(pointerBound)return;
  pointerBound=true;
  window.addEventListener('pointermove',onPointerMove,{passive:true});
  window.addEventListener('pointerout',onPointerOut,{passive:true});
};
const unbindPointerIfIdle=()=>{
  if(tickers.size || !pointerBound)return;
  pointerBound=false;
  window.removeEventListener('pointermove',onPointerMove);
  window.removeEventListener('pointerout',onPointerOut);
  if(rafId){
    cancelAnimationFrame(rafId);
    rafId=0;
  }
};

const reducedMQ=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;

type AlphaEyeProps={
  src?:string;
  className?:string;
  alt?:string;
  label?:string;
};

export function AlphaEye({src=alphaEyeImage,className='',alt,label}:AlphaEyeProps){
  const rootRef=useRef<HTMLSpanElement>(null);
  const stageRef=useRef<HTMLSpanElement>(null);
  const pupilRef=useRef<SVGGElement>(null);
  const topLidRef=useRef<SVGRectElement>(null);
  const bottomLidRef=useRef<SVGRectElement>(null);
  const id=useId().replace(/:/g,'');
  const pupilId=`alpha-pupil-${id}`;
  const socketId=`alpha-socket-${id}`;
  const accessibleLabel=label??alt??'Strip Bot';
  const decorative=accessibleLabel==='';

  useEffect(()=>{
    const root=rootRef.current;
    const stage=stageRef.current;
    const pupil=pupilRef.current;
    const topLid=topLidRef.current;
    const bottomLid=bottomLidRef.current;
    if(!root || !stage || !pupil || !topLid || !bottomLid)return;

    let hovered=false;
    let visible=true;
    let reduced=Boolean(reducedMQ?.matches);
    let targetX=0;
    let targetY=0;
    let currentX=0;
    let currentY=0;
    let lid=0;
    let lidTarget=0;
    let idleX=0;
    let idleY=0;
    let lastPointerTs=performance.now();
    let blinkToken=0;
    let idleTimer=0;
    let blinkTimer=0;
    let loopsRunning=false;
    let rect=root.getBoundingClientRect();
    const timers=new Set<number>();

    const schedule=(callback:()=>void,delay:number)=>{
      const timer=window.setTimeout(()=>{
        timers.delete(timer);
        callback();
      },delay);
      timers.add(timer);
    };
    const refreshRect=()=>{rect=root.getBoundingClientRect();};
    const paint=()=>{
      pupil.setAttribute('transform',`translate(${currentX.toFixed(2)} ${currentY.toFixed(2)})`);
      topLid.setAttribute('y',String(TOP_LID_Y+lid*LID_TRAVEL));
      bottomLid.setAttribute('y',String(BOTTOM_LID_Y-lid*LID_TRAVEL));
    };
    const reset=()=>{
      targetX=0;
      targetY=0;
      currentX=0;
      currentY=0;
      lid=0;
      lidTarget=0;
      stage.style.transform='';
      paint();
    };

    const restoreLid=()=>{
      lidTarget=hovered?HOVER_LID:0;
      wake();
    };
    const blink=(double=false)=>{
      if(reduced)return;
      const token=++blinkToken;
      lidTarget=1;
      wake();
      schedule(()=>{if(token===blinkToken)restoreLid();},110);
      if(double){
        schedule(()=>{
          if(token!==blinkToken)return;
          lidTarget=1;
          wake();
          schedule(()=>{if(token===blinkToken)restoreLid();},110);
        },260);
      }
    };

    const computeTargets=()=>{
      if(!pointer.inside){
        targetX=idleX;
        targetY=idleY;
        stage.style.transform='';
        return;
      }
      if(!rect.width || !rect.height)return;
      const eyeX=rect.left+rect.width*CX/IMAGE_SIZE;
      const eyeY=rect.top+rect.height*CY/IMAGE_SIZE;
      const dx=pointer.x-eyeX;
      const dy=pointer.y-eyeY;
      const distance=Math.hypot(dx,dy)||1;
      const strength=Math.min(1,distance/(rect.width*.6));
      targetX=dx/distance*MAX_X*strength;
      targetY=dy/distance*MAX_Y*strength;
      if(hovered){
        const rotateX=-(pointer.y-(rect.top+rect.height/2))/rect.height*TILT_DEG;
        const rotateY=(pointer.x-(rect.left+rect.width/2))/rect.width*TILT_DEG;
        stage.style.transform=`perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
      }else{
        stage.style.transform='';
      }
    };

    let lastSeenX=pointer.x;
    let lastSeenY=pointer.y;
    const tick:Tick=()=>{
      if(reduced || !visible)return false;
      if(pointer.x!==lastSeenX || pointer.y!==lastSeenY){
        lastSeenX=pointer.x;
        lastSeenY=pointer.y;
        lastPointerTs=performance.now();
        refreshRect();
      }
      const insideRoot=pointer.inside && pointer.x>=rect.left && pointer.x<=rect.right && pointer.y>=rect.top && pointer.y<=rect.bottom;
      if(insideRoot!==hovered){
        hovered=insideRoot;
        lidTarget=hovered?HOVER_LID:0;
        if(!hovered)stage.style.transform='';
      }
      computeTargets();
      currentX+=(targetX-currentX)*PUPIL_EASE;
      currentY+=(targetY-currentY)*PUPIL_EASE;
      lid+=(lidTarget-lid)*LID_EASE;
      paint();
      return Math.abs(targetX-currentX)>=SETTLE_EPS ||
        Math.abs(targetY-currentY)>=SETTLE_EPS ||
        Math.abs(lidTarget-lid)>=SETTLE_EPS;
    };

    const idleLoop=()=>{
      if(!loopsRunning)return;
      if(!reduced && visible && performance.now()-lastPointerTs>2500){
        idleX=(Math.random()*2-1)*MAX_X*.8;
        idleY=(Math.random()*2-1)*MAX_Y*.6;
        pointer.inside=false;
        wake();
      }
      idleTimer=window.setTimeout(idleLoop,1400);
    };
    const blinkLoop=()=>{
      if(!loopsRunning)return;
      if(!reduced && visible && Math.random()<.5)blink(false);
      blinkTimer=window.setTimeout(blinkLoop,3200);
    };
    const startLoops=()=>{
      if(loopsRunning || reduced)return;
      loopsRunning=true;
      idleLoop();
      blinkLoop();
    };
    const stopLoops=()=>{
      loopsRunning=false;
      window.clearTimeout(idleTimer);
      window.clearTimeout(blinkTimer);
      idleTimer=0;
      blinkTimer=0;
    };

    const enter=()=>{
      hovered=true;
      lidTarget=HOVER_LID;
      refreshRect();
      wake();
    };
    const leave=()=>{
      hovered=false;
      lidTarget=0;
      stage.style.transform='';
      wake();
    };
    const click=()=>blink(true);
    const onViewportChange=()=>{
      refreshRect();
      wake();
    };
    const onReducedChange=(event:MediaQueryListEvent)=>{
      reduced=event.matches;
      blinkToken++;
      timers.forEach(timer=>window.clearTimeout(timer));
      timers.clear();
      if(reduced){
        stopLoops();
        reset();
      }else{
        refreshRect();
        startLoops();
        wake();
      }
    };

    reducedMQ?.addEventListener('change',onReducedChange);

    const observer=typeof IntersectionObserver==='function'
      ?new IntersectionObserver(([entry])=>{
        visible=entry.isIntersecting;
        if(visible)wake();
        else reset();
      },{threshold:.01})
      :null;
    observer?.observe(root);

    root.addEventListener('pointerenter',enter);
    root.addEventListener('pointerleave',leave);
    root.addEventListener('click',click);
    window.addEventListener('resize',onViewportChange,{passive:true});
    window.addEventListener('scroll',onViewportChange,{passive:true,capture:true});
    tickers.add(tick);
    bindPointer();
    if(reduced)reset();
    else{
      startLoops();
      wake();
    }

    return()=>{
      tickers.delete(tick);
      unbindPointerIfIdle();
      observer?.disconnect();
      reducedMQ?.removeEventListener('change',onReducedChange);
      root.removeEventListener('pointerenter',enter);
      root.removeEventListener('pointerleave',leave);
      root.removeEventListener('click',click);
      window.removeEventListener('resize',onViewportChange);
      window.removeEventListener('scroll',onViewportChange,{capture:true});
      stopLoops();
      timers.forEach(timer=>window.clearTimeout(timer));
      timers.clear();
      stage.style.transform='';
    };
  },[]);

  return <span
    ref={rootRef}
    className={`alpha-eye ${className}`.trim()}
    role={decorative?undefined:'img'}
    aria-label={decorative?undefined:accessibleLabel}
    aria-hidden={decorative?true:undefined}
  >
    <span ref={stageRef} className="alpha-eye__stage">
      <img className="alpha-eye__image" src={src} alt="" draggable={false}/>
      <svg className="alpha-eye__overlay" viewBox={`0 0 ${IMAGE_SIZE} ${IMAGE_SIZE}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={pupilId} cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#2a2a2a"/>
            <stop offset="1" stopColor="#000"/>
          </radialGradient>
          <clipPath id={socketId}><ellipse cx={CX} cy={CY} rx="56" ry="74"/></clipPath>
        </defs>
        <ellipse cx={CX} cy={CY} rx="62" ry="80" fill="#efe9e2"/>
        <ellipse cx={CX} cy={CY} rx="56" ry="74" fill="#050505"/>
        <g clipPath={`url(#${socketId})`}>
          <g ref={pupilRef}>
            <ellipse cx={CX} cy={CY} rx="48" ry="66" fill={`url(#${pupilId})`}/>
            <ellipse cx={CX-17} cy={CY-28} rx="16" ry="22" fill="#fff" opacity=".95"/>
            <circle cx={CX+13} cy={CY+38} r="6" fill="#fff" opacity=".8"/>
          </g>
          <rect ref={topLidRef} x="300" y={TOP_LID_Y} width="200" height="126" fill="#efe9e2"/>
          <rect ref={bottomLidRef} x="300" y={BOTTOM_LID_Y} width="200" height="126" fill="#efe9e2"/>
        </g>
      </svg>
    </span>
  </span>;
}

export default AlphaEye;

