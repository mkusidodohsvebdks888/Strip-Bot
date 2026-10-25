export const reasoningLabels=['轻度','中','高','极高','Ultra'];
export function reasoningChoices(variants){
  return ['low','medium','high','xhigh','max'].map(effort=>variants.find(v=>v.effort===effort) || null);
}
