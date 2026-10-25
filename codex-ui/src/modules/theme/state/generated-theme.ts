/* OpenUI may generate arbitrary HTML/CSS. Import only a strict allowlist
   of hexadecimal semantic colors; never execute external code in StripBot. */
export type GeneratedPalette=Record<string,string>;
export const STORAGE_KEY='strip_openui_palette_v1';
const TOKENS=[
 '--bg','--sidebar-bg','--card-bg','--head-bg','--surface-search',
 '--surface-2','--surface-3','--fg','--fg-strong','--muted',
 '--accent','--accent-hover','--accent-contrast','--border-focus'
] as const;
const ALLOWED=new Set<string>(TOKENS);
const HEX=/^#[0-9a-fA-F]{3,4}(?:[0-9a-fA-F]{3,4})?$/;
const EL_ID='strip-generated-openui-theme';
export function parseOpenUITheme(source:string):GeneratedPalette{
 if(typeof source!=='string'||!source.trim()||source.length>12000)throw new Error('CSS 颜色变量为空或超过 12000 字符。');
 const colors:GeneratedPalette={};
 for(const m of source.matchAll(/(--[a-z][a-z0-9-]*)\s*:\s*([^;\}\n]+)\s*;?/gi)){
   if(!ALLOWED.has(m[1]))continue;
   const value=m[2].trim();
   if(!HEX.test(value))throw new Error(m[1]+' 仅允许十六进制颜色，例如 #e3e8ef。');
   colors[m[1]]=value;
 }
 if(!colors['--bg']||!colors['--fg']||!colors['--accent'])throw new Error('必须包含 --bg、--fg 和 --accent 颜色变量。');
 return colors;
}
export function hasImportedTheme(){
 return typeof document!=='undefined' && Boolean(document.getElementById(EL_ID));
}
export function clearImportedTheme(){
 try{localStorage.removeItem(STORAGE_KEY);}catch{/* browser storage is optional */}
 document.getElementById(EL_ID)?.remove();
 window.dispatchEvent(new Event('strip:openui-theme-changed'));
}
export function applyImportedTheme(input:GeneratedPalette,{persist=true}={}){
 const colors=parseOpenUITheme(Object.entries(input).map(([k,v])=>k+':'+v+';').join('\n'));
 const selectors=[
   'html[data-strip-palette]',
   'html[data-strip-palette] .strip-app[data-appearance]',
   'html[data-strip-palette] .strip-api-entry[data-appearance]',
   'html[data-strip-palette] .strip-account-menu'
 ];
 const css=selectors.join(',\n')+' {\n'+Object.entries(colors).map(([k,v])=>k+':'+v+' !important;').join('\n')+'\n}';
 let style=document.getElementById(EL_ID);
 if(!style){style=document.createElement('style');style.id=EL_ID;document.head.appendChild(style);}
 style.textContent=css;
 if(persist)try{localStorage.setItem(STORAGE_KEY,JSON.stringify(colors));}catch{/* optional */}
 window.dispatchEvent(new Event('strip:openui-theme-changed'));
}
export function restoreImportedTheme(){
 try{
   const stored=localStorage.getItem(STORAGE_KEY);
   if(!stored)return false;
   const decoded:unknown=JSON.parse(stored);
   if(!decoded||typeof decoded!=='object'||Array.isArray(decoded))return false;
   const filtered:GeneratedPalette={};
   for(const [k,v] of Object.entries(decoded))if(ALLOWED.has(k)&&typeof v==='string')filtered[k]=v;
   applyImportedTheme(filtered,{persist:false});
   return true;
 }catch{return false;}
}
