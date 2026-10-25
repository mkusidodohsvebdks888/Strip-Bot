import {processingMode,speedChoices} from './processing-speed.mjs';
import {reasoningChoices} from './reasoning.mjs';

// One user-facing control combines the thinking budget, a *declared* native
// fast-model alias (when present) and text reveal pacing. It does not promise
// to change the upstream provider's real token generation rate.
export const responsePresets=Object.freeze([
  {id:'sprint',label:'极速',effort:'low',preferredSpeed:'ultrafast',displayRate:null,description:'轻量思考，优先即时响应'},
  {id:'fast',label:'快速',effort:'medium',preferredSpeed:'fast',displayRate:200,description:'适度思考，较快显示'},
  {id:'balanced',label:'均衡',effort:'high',preferredSpeed:'standard',displayRate:160,description:'充分思考，均衡表现'},
  {id:'deep',label:'深度',effort:'xhigh',preferredSpeed:'standard',displayRate:120,description:'更多推理时间，适合复杂问题'},
  {id:'maximum',label:'极致',effort:'max',preferredSpeed:'standard',displayRate:90,description:'优先最深度推理，可能更慢'},
]);

const speedPriority={ultrafast:[2,1,0],fast:[1,0,2],standard:[0,1,2]};

export function responseOptions(models,route,modelId){
  const current=models.find(item=>item.id===modelId);
  const currentRoute=current?.routes.find(entry=>entry.id===route && entry.configured);
  const fastChoices=speedChoices(models,modelId,route);
  const available=fastChoices.filter(Boolean);
  const hasAnyReasoning=available.some(item=>item.routes.some(entry=>entry.id===route && entry.configured && entry.variants?.length));
  return responsePresets.map((preset,index)=>{
    // Select a real, configured model. Never guess a fast URL/model ID.
    const preferred=speedPriority[preset.preferredSpeed]
      .map(i=>fastChoices[i])
      .filter(Boolean);
    const ranked=preferred.filter(item=>item.routes.some(entry=>entry.id===route && entry.configured));
    const candidate=hasAnyReasoning
      ? ranked.find(item=>reasoningChoices(item.routes.find(entry=>entry.id===route)?.variants || [])[index])
      : ranked[0];
    const target=candidate || current;
    const variant=candidate && hasAnyReasoning
      ? reasoningChoices(candidate.routes.find(entry=>entry.id===route)?.variants || [])[index]?.id || ''
      : '';
    const supported=Boolean(current && currentRoute && candidate && (!hasAnyReasoning || variant));
    return {...preset,model:target?.id || modelId,variant,
      supported,reasoningSupported:Boolean(variant),
      speedMode:route==='opencode' && target?processingMode(target.id):'standard',
      speedModelAvailable:route==='opencode' && available.some(item=>processingMode(item.id)!=='standard'),
      displayOnly:!hasAnyReasoning && !(route==='opencode' && available.some(item=>processingMode(item.id)!=='standard'))};
  });
}

export function activePresetIndex(presetId,variant,variants=[]){
  const explicit=responsePresets.findIndex(item=>item.id===presetId);
  if(explicit>=0)return explicit;
  const effort=variants.find(item=>item.id===variant)?.effort;
  const guessed=responsePresets.findIndex(item=>item.effort===effort);
  return guessed>=0?guessed:2;
}
