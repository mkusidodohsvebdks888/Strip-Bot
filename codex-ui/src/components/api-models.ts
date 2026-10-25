/** Models are fetched through the local gateway so API credentials never appear in a URL. */
export type DiscoveredModel={id:string;name:string;supportsReasoning:boolean};
export type DiscoveredModels={models:DiscoveredModel[];source:string};
export async function discoverModels(options:{baseUrl?:string;apiKey?:string;clearKey?:boolean;refresh?:boolean}={},signal?:AbortSignal):Promise<DiscoveredModels>{
  const response=await fetch('/api/connection/models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options),signal:signal || AbortSignal.timeout(16000)});
  const value=await response.json();
  if(!response.ok)throw new Error(value.error || `读取模型失败（HTTP ${response.status}）。`);
  if(!Array.isArray(value.models))throw new Error('模型接口返回格式不正确。');
  return value as DiscoveredModels;
}
