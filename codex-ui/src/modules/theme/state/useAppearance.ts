import {useLayoutEffect,useState} from 'react';

export type StripAppearance = 'warm' | 'white' | 'mist' | 'dark' | 'graphite';
const storageKey = 'strip_appearance_v1';
export const THEME_CHOICES: {id:StripAppearance;name:string;description:string}[] = [
  {id:'white',name:'纯净白',description:'明亮清爽'},
  {id:'warm',name:'暖米白',description:'柔和舒适'},
  {id:'mist',name:'雾蓝灰',description:'清冷安静'},
  {id:'dark',name:'经典深色',description:'低亮度暖灰'},
  {id:'graphite',name:'石墨灰',description:'沉稳中性'},
];
export const appearanceLabels = Object.fromEntries(THEME_CHOICES.map(item=>[item.id,item.name])) as Record<StripAppearance,string>;
export function baseAppearance(value:StripAppearance):'warm'|'white'|'dark'{
  return value==='graphite'?'dark':value==='mist'?'white':value;
}
function readAppearance():StripAppearance {
  try {
    const saved=localStorage.getItem(storageKey);
    if(THEME_CHOICES.some(item=>item.id===saved))return saved as StripAppearance;
    // Import the previous theme setting only if this app has no appearance preference.
    if(!saved){
      const legacy=localStorage.getItem('strip_ui_theme_v1');
      if(legacy==='light')return 'white';
      if(legacy==='ivory')return 'warm';
      if(legacy==='mist' || legacy==='dark' || legacy==='graphite')return legacy;
    }
  }catch{/* Storage is optional. */}
  return 'warm';
}
export function useAppearance(){
  const [appearance,setAppearance]=useState<StripAppearance>(readAppearance);
  useLayoutEffect(()=>{
    try{localStorage.setItem(storageKey,appearance);}catch{/* optional preference */}
    const base=baseAppearance(appearance);
    document.documentElement.dataset.stripAppearance=base;
    document.documentElement.dataset.stripPalette=appearance;
    document.documentElement.dataset.stripTheme=base==='dark'?'dark':'light';
    document.documentElement.style.colorScheme=base==='dark'?'dark':'light';
    if(window.stripWindowAppearance){document.documentElement.dataset.stripDesktop='true';window.stripWindowAppearance.sync(appearance);}
  },[appearance]);
  // Keep separate StripBot browser windows in step; a storage event only fires in other windows.
  useLayoutEffect(()=>{
    const sync=(event:StorageEvent)=>{
      if(event.key!==storageKey)return;
      const requested=event.newValue;
      if(THEME_CHOICES.some(item=>item.id===requested))setAppearance(requested as StripAppearance);
    };
    window.addEventListener?.('storage',sync);
    return ()=>window.removeEventListener?.('storage',sync);
  },[]);
  return {appearance,setAppearance};
}
