import {useEffect} from 'react';

/** Scroll the active model into the compact two-row list whenever it opens or reloads. */
export function useScrollSelectedIntoView(open:boolean,popup:HTMLElement|null,revision?:unknown){
  useEffect(()=>{
    if(!open || !popup)return;
    const run=()=>{
      const selected=popup.querySelector?.<HTMLElement>('[aria-current="true"], [aria-selected="true"]');
      if(!selected || typeof selected.closest!=='function')return;
      const scroller=selected.closest<HTMLElement>('.smp-simple-models');
      if(!scroller){
        selected.scrollIntoView({block:'nearest'});
        return;
      }
      const scrollerRect=scroller.getBoundingClientRect();
      const itemRect=selected.getBoundingClientRect();
      const itemTop=itemRect.top-scrollerRect.top+scroller.scrollTop;
      const itemBottom=itemTop+itemRect.height;
      if(itemTop<scroller.scrollTop)scroller.scrollTop=itemTop;
      else if(itemBottom>scroller.scrollTop+scroller.clientHeight)scroller.scrollTop=itemBottom-scroller.clientHeight;
    };
    const frame=typeof globalThis.requestAnimationFrame==='function'
      ?globalThis.requestAnimationFrame(run)
      :globalThis.setTimeout(run,0);
    return()=>{
      if(typeof globalThis.cancelAnimationFrame==='function')globalThis.cancelAnimationFrame(frame);
      else globalThis.clearTimeout(frame);
    };
  },[open,popup,revision]);
}

