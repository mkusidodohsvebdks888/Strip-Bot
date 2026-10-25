import {useLayoutEffect,useState} from 'react';
import type {CSSProperties,RefObject} from 'react';

type Rectangle = {left:number;right:number;top:number;bottom:number};
type Dimensions = {width:number;height:number};
type Options = {width:number;align?:'start'|'end';gap?:number;margin?:number};
type Placement = {left:number;top:number;maxHeight:number};

/**
 * Keep a floating menu beside its button, even when the left tool panel changes width.
 * Popovers are fixed-position because the chat viewport can independently scroll.
 */
export function calculatePopupPlacement(
  anchor:Rectangle,
  popup:Dimensions,
  viewport:Dimensions,
  {width,align='end',gap=8,margin=12}:Options,
):Placement {
  const usableWidth=Math.max(1,viewport.width-2*margin);
  const popupWidth=Math.min(popup.width || width,usableWidth);
  const preferLeft=align==='end'?anchor.right-popupWidth:anchor.left;
  const left=Math.round(Math.max(margin,Math.min(preferLeft,viewport.width-popupWidth-margin)));
  const above=Math.max(0,anchor.top-gap-margin);
  const below=Math.max(0,viewport.height-anchor.bottom-gap-margin);
  const height=Math.min(popup.height || 200,Math.max(0,viewport.height-2*margin));
  const placeAbove=above>=height || above>below;
  const available=placeAbove?above:below;
  const top=placeAbove
    ? Math.round(Math.max(margin,anchor.top-gap-Math.min(height,available)))
    : Math.round(Math.min(anchor.bottom+gap,viewport.height-margin));
  const maxHeight=Math.max(0,Math.floor(placeAbove?anchor.top-gap-top:viewport.height-margin-top));
  return {left,top,maxHeight};
}

export function useAnchoredPopup(
  visible:boolean,
  anchorRef:RefObject<HTMLElement>,
  popupRef:RefObject<HTMLElement>,
  options:Options,
):CSSProperties {
  const [position,setPosition]=useState<Placement>({left:12,top:12,maxHeight:320});
  const {width,align='end',gap=8,margin=12}=options;
  useLayoutEffect(()=>{
    if(!visible)return;
    const reposition=()=>{
      const anchor=anchorRef.current,popup=popupRef.current;
      if(!anchor || !popup)return;
      const rect=anchor.getBoundingClientRect();
      const box=popup.getBoundingClientRect();
      // offsetWidth is the untransformed layout width. During a scale-in
      // animation getBoundingClientRect() is smaller, which would shift fixed
      // popovers sideways as the animation settles.
      const popupWidth=popup.offsetWidth || box.width || width;
      const popupHeight=popup.scrollHeight || popup.offsetHeight || box.height;
      const placement=calculatePopupPlacement(rect,{
        width:popupWidth,
        height:popupHeight,
      },{width:window.innerWidth,height:window.innerHeight},{width,align,gap,margin});
      setPosition(previous=>previous.left===placement.left && previous.top===placement.top && previous.maxHeight===placement.maxHeight?previous:placement);
    };
    reposition();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(reposition):null;
    for(const node of [anchorRef.current,popupRef.current,anchorRef.current?.closest('main')]){
      if(node)observer?.observe(node);
    }
    // Capture nested scrolling: the conversation and tool list each have their own scroller.
    const mutation=typeof MutationObserver!=='undefined' && popupRef.current?new MutationObserver(reposition):null;
    if(popupRef.current)mutation?.observe(popupRef.current,{childList:true,subtree:true,characterData:true});
    window.addEventListener('scroll',reposition,true);
    window.addEventListener('resize',reposition);
    window.visualViewport?.addEventListener('resize',reposition);
    window.visualViewport?.addEventListener('scroll',reposition);
    return ()=>{
      observer?.disconnect();
      mutation?.disconnect();
      window.removeEventListener('scroll',reposition,true);
      window.removeEventListener('resize',reposition);
      window.visualViewport?.removeEventListener('resize',reposition);
      window.visualViewport?.removeEventListener('scroll',reposition);
    };
  },[visible,anchorRef,popupRef,width,align,gap,margin]);
  return {...position,bottom:'auto'};
}
