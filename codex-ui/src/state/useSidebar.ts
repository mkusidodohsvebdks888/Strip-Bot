import {useCallback,useEffect,useState} from 'react';
import type {SetStateAction} from 'react';

const preferenceKey='strip_sidebar_expanded_v1';
function readExpanded(){
  try{return localStorage.getItem(preferenceKey)!=='false';}catch{return true;}
}

/** Desktop preference survives temporary mobile drawers and automatic mobile dismissal. */
export function useSidebar(){
  const [expanded,setExpanded]=useState(readExpanded);
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 900px)').matches);
  const [mobileOpen,setMobileOpen]=useState(false);
  const panelOpen=compact?mobileOpen:expanded;
  const setPanelOpen=useCallback((next:SetStateAction<boolean>)=>{
    if(compact)setMobileOpen(next);else setExpanded(next);
  },[compact]);
  useEffect(()=>{
    try{localStorage.setItem(preferenceKey,String(expanded));}catch{/* Optional preference. */}
  },[expanded]);
  useEffect(()=>{
    const breakpoint=window.matchMedia('(max-width: 900px)');
    const change=()=>{setCompact(breakpoint.matches);setMobileOpen(false);};
    breakpoint.addEventListener('change',change);
    return()=>breakpoint.removeEventListener('change',change);
  },[]);
  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      if(event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.shiftKey)return;
      if((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='b'){
        event.preventDefault();setPanelOpen(value=>!value);
      }
    };
    window.addEventListener('keydown',keydown);
    return()=>window.removeEventListener('keydown',keydown);
  },[setPanelOpen]);
  useEffect(()=>{
    // A hidden panel must not retain keyboard focus on its close button or contents.
    if(!panelOpen && document.activeElement?.closest('#strip-tool-panel')){
      document.querySelector<HTMLButtonElement>('[aria-controls="strip-tool-panel"][aria-expanded]')?.focus();
    }
  },[panelOpen]);
  return {panelOpen,setPanelOpen};
}
