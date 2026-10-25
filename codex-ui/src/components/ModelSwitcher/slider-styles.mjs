/** Local-only appearance presets. These do not change model reasoning or API latency. */
export const sliderStyleKey = 'strip_slider_style_v1';
export const sliderStyleEvent = 'strip:slider-style-changed';
export const defaultSliderStyle = 'dots';
export const sliderStyles = Object.freeze([
  Object.freeze({id:'dots', label:'Five Dots', description:'Snaps to steps · Recommended'}),
  Object.freeze({id:'line', label:'Minimal Line', description:'Codex style'}),
  Object.freeze({id:'pill', label:'Soft Pill', description:'Claude style'}),
  Object.freeze({id:'segments', label:'Segments', description:'Click to switch directly'}),
  Object.freeze({id:'gradient', label:'Fluid Gradient', description:'Gentle gradient effect'}),
  Object.freeze({id:'energy', label:'Energy Flow', description:'Gradient track · Motion tail · Release ripple'}),
]);
export function normalizeSliderStyle(value){
  return sliderStyles.some(style=>style.id===value) ? value : defaultSliderStyle;
}
export function readSliderStyle(storage){
  try { const source=storage??globalThis.localStorage; return normalizeSliderStyle(source?.getItem(sliderStyleKey)); }
  catch { return defaultSliderStyle; }
}
export function saveSliderStyle(value,storage){
  const next=normalizeSliderStyle(value);
  try { const destination=storage??globalThis.localStorage; destination?.setItem(sliderStyleKey,next); }
  catch { /* Appearance selection works for this session without storage. */ }
  return next;
}
