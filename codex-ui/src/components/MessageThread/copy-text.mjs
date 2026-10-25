export async function copyToClipboard(value,environment=globalThis){
  try{if(environment.navigator?.clipboard?.writeText){await environment.navigator.clipboard.writeText(value);return;}}catch{/* Fall back when clipboard permissions are unavailable. */}
  const doc=environment.document;if(!doc?.body)throw new Error('Clipboard unavailable');
  const active=doc.activeElement,selection=doc.getSelection?.();
  const ranges=selection?Array.from({length:selection.rangeCount},(_,i)=>selection.getRangeAt(i).cloneRange()):[];
  const area=doc.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.cssText='position:fixed;left:-9999px;opacity:0';
  try{doc.body.append(area);area.select();if(!doc.execCommand('copy'))throw new Error('Copy failed');}
  finally{area.remove();active?.focus?.({preventScroll:true});if(selection){selection.removeAllRanges();ranges.forEach(range=>selection.addRange(range));}}
}
