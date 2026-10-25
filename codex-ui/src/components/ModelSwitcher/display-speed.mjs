/** Five stable visual presets. null = no UI pacing; never changes model latency. */
export const displayRates=[30,60,100,160,null];
export const displayRateLabels=['舒缓','自然','均衡','流畅','即时'];
export function displayRateIndex(value){
  if(value===null || value===undefined)return 4;
  if(!Number.isFinite(value))return 4;
  return displayRates.slice(0,4).reduce((best,rate,index)=>Math.abs(rate-value)<Math.abs(displayRates[best]-value)?index:best,0);
}
export function displayRateForIndex(index){
  const safe=Math.max(0,Math.min(4,Math.round(index)));
  return displayRates[safe];
}
