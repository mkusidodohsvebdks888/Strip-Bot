'use strict';
const {createEngine} = require('./agent/codex-engine.cjs');

// Account UI compatibility: same /api/connection/account/* routes,
// with Codex-managed ChatGPT authorization instead of OpenCode OAuth.
function createAccount({root,executable,engine}={}) {
  const codex=engine || createEngine({root,executable,provider:'codex'});
  let attempt=null,queue=Promise.resolve(),catalog={at:0,models:[]};
  const serial=fn=>{const work=queue.then(fn);queue=work.catch(()=>{});return work;};
  const models=async()=>{
    if(Date.now()-catalog.at<30000)return catalog.models;
    const response=await codex.request('/api/model');
    const list=(response.data||[]).filter(m=>m.providerID==='openai').map(m=>({
      id:m.modelID||m.id?.replace(/^openai\//,''),name:m.name||m.modelID,
      variants:(m.variants||[]).map(v=>({id:v.id,effort:v.settings?.reasoningEffort})),
    }));
    catalog={at:Date.now(),models:list};return list;
  };
  return {
    status:()=>serial(async()=>{
      const result=await codex.rpc('account/read',{refreshToken:false});
      const connected=Boolean(result.account);
      if(connected)attempt=null;
      return {connected,models:connected?await models():[],attempt:attempt?{status:'pending'}:undefined};
    }),
    login:()=>serial(async()=>{
      if(attempt){try{await codex.rpc('account/login/cancel',{loginId:attempt});}catch{}}
      const result=await codex.rpc('account/login/start',{type:'chatgpt',useHostedLoginSuccessPage:true,appBrand:'codex'});
      const url=new URL(result.authUrl||'');
      if(url.protocol!=='https:' || !['chatgpt.com','auth.openai.com'].includes(url.hostname.toLowerCase()) || url.username || url.password)throw new Error('Codex 授权 URL 不符合预期。');
      attempt=result.loginId;
      return {url:url.href,status:'pending'};
    }),
    cancel:()=>serial(async()=>{
      if(attempt)await codex.rpc('account/login/cancel',{loginId:attempt});
      attempt=null;return {ok:true};
    }),
    close:()=>serial(async()=>codex.close()),
  };
}
module.exports={createAccount};
