'use strict';
const path = require('node:path');
const {createEngine} = require('./agent/engine.cjs');

function createAccount({root,executable,engine}={}) {
  const sidecar=engine || createEngine({root,executable,provider:'opencode',configHome:path.join(root,'.runtime','opencode','account-config')});
  let attempt,queue=Promise.resolve();
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  async function status(){
    await sidecar.ensure();
    const list=await sidecar.request('/api/integration');
    const integration=(list.data || []).find(item=>item.id==='openai');
    const connected=Boolean(integration?.connections?.some(item=>item.type==='credential' && item.method==='oauth'));
    let progress;
    if(attempt){
      try {
        const value=await sidecar.request('/api/integration/openai/connect/oauth/'+encodeURIComponent(attempt));
        progress={status:value.data.status,message:value.data.status==='failed'?'本次授权未完成，请重新登录。':undefined};
        if(['complete','failed','expired'].includes(value.data.status))attempt=undefined;
      }catch(error){
        if(error.status!==404)throw error;
        attempt=undefined;progress={status:'expired'};
      }
    }
    const catalog=connected ? await sidecar.request('/api/model') : {data:[]};
    const models=(catalog.data || []).filter(item=>item.providerID==='openai' && item.enabled!==false).map(item=>({id:typeof item.id==='string'?item.id.replace(/^openai\//,''):item.modelID,name:item.name || item.modelID,variants:(item.variants || []).filter(v=>typeof v.settings?.reasoningEffort==='string').map(v=>({id:v.id,effort:v.settings.reasoningEffort}))})).filter(item=>item.id);
    return {connected,models,attempt:progress};
  }
  return {
    status:()=>serial(status),
    login:()=>serial(async()=>{
      await status();
      if(attempt)await sidecar.request('/api/integration/openai/connect/oauth/'+encodeURIComponent(attempt),undefined,'DELETE').catch(()=>{});
      const value=await sidecar.request('/api/integration/openai/connect/oauth',{methodID:'chatgpt-browser'});
      attempt=value.data.attemptID;
      const url=new URL(value.data.url);
      if(url.protocol!=='https:' || url.hostname!=='auth.openai.com' || url.username || url.password)throw new Error('授权地址无效。');
      return {url:url.href,status:'pending'};
    }),
    cancel:()=>serial(async()=>{if(attempt)await sidecar.request('/api/integration/openai/connect/oauth/'+encodeURIComponent(attempt),undefined,'DELETE');attempt=undefined;return {ok:true};}),
    close:()=>serial(async()=>{if(attempt)await sidecar.request('/api/integration/openai/connect/oauth/'+encodeURIComponent(attempt),undefined,'DELETE').catch(()=>{});await sidecar.close();}),
  };
}
module.exports={createAccount};
