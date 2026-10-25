'use strict';
const URL='http://127.0.0.1:7878/';
const SOURCE='42d7ab4ab6650433486dfb12eb3783c393a3e475';
async function status({fetchImpl=globalThis.fetch,timeoutMs=2500}={}){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
  try{
    const response=await fetchImpl(URL,{method:'GET',redirect:'manual',headers:{Accept:'text/html'},signal:abort.signal});
    const length=Number(response.headers?.get?.('content-length')||0);
    const type=response.headers?.get?.('content-type')||'';
    if(response.status!==200||length>65536||!type.includes('text/html')){
      await response.body?.cancel?.().catch(()=>{});
      return {online:false,url:URL,source:SOURCE};
    }
    const body=await response.text();
    return {online:body.length<65536&&/openui|open ui/i.test(body),url:URL,source:SOURCE};
  }catch{return {online:false,url:URL,source:SOURCE};}
  finally{clearTimeout(timer);}
}
module.exports={status,OPENUI_LOCAL_URL:URL,OPENUI_SOURCE:SOURCE};
