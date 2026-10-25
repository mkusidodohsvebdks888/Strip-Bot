export async function workspaceRequest<T>(endpoint:string,body?:unknown):Promise<T>{
  const result=await fetch(endpoint,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const json=await result.json().catch(()=>({error:`HTTP ${result.status} · 服务器没有返回 JSON`}));
  if(!result.ok)throw new Error(json.error || json.message || `HTTP ${result.status}`);
  return json as T;
}
export const shortError=(e:unknown)=>e instanceof Error?e.message:'操作失败，请检查服务连接';
