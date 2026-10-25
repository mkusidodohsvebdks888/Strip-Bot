export const familyID=id=>id.replace(/-(ultrafast|fast)$/i,'');
export const familyName=name=>name.replace(/(?:\s+|[-_])(ultrafast|fast)$/i,'');
export function modelFamilies(models){
  const groups=new Map();
  for(const model of models){
    const id=familyID(model.id),key=model.vendorId+'|'+id;
    if(!groups.has(key))groups.set(key,{id,name:familyName(model.name),vendorId:model.vendorId,models:[]});
    const group=groups.get(key);group.models.push(model);
    if(model.id===id)group.name=model.name;
  }
  return [...groups.values()];
}
export function familyChoice(family,route,currentModel){
  const tier=currentModel.match(/-(ultrafast|fast)$/i)?.[1]?.toLowerCase();
  const expected=tier?family.id+'-'+tier:family.id;
  const configured=family.models.filter(item=>item.routes.some(entry=>entry.configured));
  const sameRoute=configured.filter(item=>item.routes.some(entry=>entry.id===route && entry.configured));
  const candidates=sameRoute.length?sameRoute:configured;
  return candidates.find(item=>item.id===expected) || candidates.find(item=>item.id===family.id) || candidates[0] || null;
}
