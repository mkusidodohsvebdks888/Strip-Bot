import {modelVendor,modelVendors} from '../model-vendors';
import type {ConnectionMode} from '../../state/useConnection';
import {discoverModels} from '../api-models';

export type Route={id:ConnectionMode;name:string;configured:boolean;status:string;variants?:{id:string;effort:string}[]};
export type CatalogModel={id:string;name:string;vendorId:string;routes:Route[]};
export type ApiStatus={baseUrl:string;model:string;protocol:string;configured:boolean;revision:string;reasoningEnabled:boolean;reasoningEffort:string};
export type Catalog={models:CatalogModel[];api:ApiStatus|null;errors:string[]};
export const routeNames:Record<ConnectionMode,string>={opencode:'ChatGPT · OpenCode',ccswitch:'CC Switch',direct:'API Key 连接'};
export async function readStatus<T>(path:string):Promise<T>{
  const response=await fetch(path,{signal:AbortSignal.timeout(45000)}),value=await response.json();
  if(!response.ok)throw new Error(value.error || '读取连接失败');
  return value;
}
export function savedModelIds(baseUrl:string){
  try{const entries=Object.entries(JSON.parse(localStorage.getItem('strip_api_model_history_v1') || '{}'));
    return entries.flatMap(([key,ids])=>key.endsWith('|'+baseUrl) && Array.isArray(ids)?ids.filter((id):id is string=>typeof id==='string'):[]);
  }catch{return [];}
}
export async function loadCatalog():Promise<Catalog>{
  const results=await Promise.allSettled([
    readStatus<{connected:boolean;models:{id:string;name:string;variants?:{id:string;effort:string}[]}[]}>('/api/connection/account/status'),
    readStatus<{healthy:boolean;codex?:{model?:string}}>('/api/cc-switch/status'),
    readStatus<ApiStatus>('/api/connection/status'),
  ]);
  const models:CatalogModel[]=[],errors:string[]=[];
  function add(id:string,name:string,route:Route){
    if(!id)return;
    const existing=models.find(model=>model.id===id);
    if(existing)existing.routes.push(route);
    else models.push({id,name:name || id,vendorId:modelVendor(id),routes:[route]});
  }
  const [native,cc,direct]=results;
  if(native.status==='fulfilled')for(const model of native.value.models || [])add(model.id,model.name,{id:'opencode',name:routeNames.opencode,configured:native.value.connected,status:'已授权 · 模型可用性以请求为准',variants:model.variants});
  if(cc.status==='fulfilled' && cc.value.codex?.model)add(cc.value.codex.model,cc.value.codex.model,{id:'ccswitch',name:routeNames.ccswitch,configured:cc.value.healthy,status:cc.value.healthy?'代理在线 · 上游认证未验证':'代理未启动'});
  const api=direct.status==='fulfilled'?direct.value:null;
  if(api){
    let available:{id:string;name:string}[]=[];
    if(api.configured && api.baseUrl){try{available=(await discoverModels({baseUrl:api.baseUrl})).models;}catch(e){errors.push('实时模型列表未获取：'+(e instanceof Error?e.message:'连接失败')+'（可使用已保存模型）');}}
    const names=new Map(available.map(value=>[value.id,value.name]));
    for(const id of new Set([api.model,...savedModelIds(api.baseUrl),...available.map(item=>item.id)]))
      add(id,names.get(id)||id,{id:'direct',name:routeNames.direct,configured:api.configured,status:api.configured?'已保存配置 · 可用性以请求为准':'尚未配置',variants:api.reasoningEnabled?['low','medium','high','xhigh','max'].map(effort=>({id:effort,effort})):[]});
  }
  results.forEach((result,index)=>{if(result.status==='rejected')errors.push([routeNames.opencode,routeNames.ccswitch,routeNames.direct][index]+'：读取失败');});
  return {models,api,errors};
}
export {modelVendors};
