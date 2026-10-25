'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {randomBytes,createHash}=require('node:crypto');
const {httpError,requireLocalUrl,extractText}=require('../../core/providers/index.cjs');
const MODEL_ID=/^[\w.\-/:]{1,150}$/;
const EFFORTS=new Set(['low','medium','high','xhigh','max']);

// Windows DPAPI binds the saved key to the current Windows user. No shell args contain it.
function protectKey(value,decrypt=false) {
  const command=decrypt
    ? '[void][Reflection.Assembly]::LoadWithPartialName("System.Security");$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());[Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'
    : '[void][Reflection.Assembly]::LoadWithPartialName("System.Security");$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))';
  if(process.platform!=='win32') return Promise.reject(httpError(500,'此版本使用 Windows 用户加密保存 API Key。'));
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let out='';const timer=setTimeout(()=>{child.kill();reject(httpError(500,'密钥加密操作超时。'));},10000);
    child.stdout.on('data',chunk=>{out+=chunk;});child.stderr.resume();
    child.once('error',()=>{clearTimeout(timer);reject(httpError(500,'无法访问 Windows 密钥加密服务。'));});
    child.once('exit',code=>{clearTimeout(timer);code===0 ? resolve(out.trim()):reject(httpError(500,'密钥加密操作失败，请使用原 Windows 账号。'));});
    child.stdin.on('error',()=>{});child.stdin.end(value);
  });
}
function normalizeBase(value) {
  let url;try{url=new URL(value);}catch{throw httpError(400,'请填写有效的 API 地址。');}
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:' && !(url.protocol==='http:' && local)) throw httpError(400,'公网 API 必须使用 HTTPS；本机地址可以使用 HTTP。');
  if(url.username || url.password || url.search || url.hash) throw httpError(400,'API 地址不能包含账号、密码、查询参数或片段。');
  url.pathname=url.pathname.replace(/\/(responses|chat\/completions)\/?$/,'').replace(/\/$/,'');
  return url.href.replace(/\/$/,'');
}
// Fixed local descriptions only: never echo a provider body that may contain secrets.
function connectionFailure(status) {
  const descriptions={401:'API 密钥认证失败，请重新复制完整密钥，或在官方平台新建密钥后重试。',403:'API 服务拒绝访问，请检查账号权限、网络出口或代理。',402:'API 账户余额不足，请在服务商平台检查余额。',429:'API 请求频率或额度受限，请稍后重试并检查服务商限制。'};
  return (descriptions[status] || 'API 请求失败，请检查模型、协议和服务状态。')+'（HTTP '+status+'）';
}
function createApiConnection({root,fetchImpl=fetch,vault=protectKey}={}) {
  const file=path.join(root,'.runtime','api-connection.json');
  const relayKey=randomBytes(32).toString('hex');
  let cached,queue=Promise.resolve();
  const modelCache=new Map();
  const load=async()=>{
    if(cached)return cached;
    try {const value=JSON.parse(await fs.readFile(file,'utf8'));cached={...value,apiKey:value.encryptedKey ? await vault(value.encryptedKey,true):''};}
    catch(error){if(error.code!=='ENOENT')throw httpError(500,'API 配置无法读取，请重新保存连接。');cached={baseUrl:'',model:'',protocol:'responses',apiKey:'',encryptedKey:'',revision:'',reasoningEnabled:false,reasoningEffort:''};}
    return cached;
  };
  const publicView=value=>({baseUrl:value.baseUrl,model:value.model,protocol:value.protocol,hasKey:Boolean(value.apiKey),configured:Boolean(value.baseUrl && value.model),revision:value.revision,reasoningEnabled:value.reasoningEnabled===true,reasoningEffort:value.reasoningEffort || ''});
  async function upstream(value,payload,signal) {
    const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'};
    if(value.apiKey)headers.Authorization='Bearer '+value.apiKey;
    const request={...payload,model:value.model};
    if(value.reasoningEnabled && value.reasoningEffort){
      // OpenAI-compatible Responses and Chat Completions use different field shapes.
      if(value.protocol==='responses'){
        const existing=request.reasoning && typeof request.reasoning==='object' && !Array.isArray(request.reasoning)?request.reasoning:{};
        request.reasoning={...existing,effort:value.reasoningEffort};
      }
      else if(request.thinking?.type !== 'disabled') request.reasoning_effort=value.reasoningEffort; // Chat bridge disables thinking to avoid unsafe reasoning replay across tool calls.
    }
    return fetchImpl(value.baseUrl+(value.protocol==='responses'?'/responses':'/chat/completions'),{method:'POST',headers,body:JSON.stringify(request),redirect:'error',signal});
  }
  async function models(body={}) {
    if(!body || typeof body!=='object' || Array.isArray(body))throw httpError(400,'读取模型列表的请求格式无效。');
    const previous=await load();
    const baseUrl=normalizeBase(body.baseUrl || previous.baseUrl);
    if(body.apiKey!==undefined && (typeof body.apiKey!=='string' || /[\r\n\0]/.test(body.apiKey) || body.apiKey.length>4096))throw httpError(400,'API Key 格式无效。');
    // A new destination may NEVER inherit the saved credentials (even in discovery).
    const apiKey=body.clearKey?'':body.apiKey?.trim() || (baseUrl===previous.baseUrl?previous.apiKey:'');
    const cacheKey=createHash('sha256').update(JSON.stringify([baseUrl,apiKey])).digest('hex');
    const earlier=modelCache.get(cacheKey);
    if(!body.refresh && earlier && earlier.until>Date.now())return earlier.value;
    const headers={'Accept':'application/json'};
    if(apiKey)headers.Authorization='Bearer '+apiKey;
    let response;
    try{response=await fetchImpl(baseUrl+'/models',{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(12000)});}
    catch{throw httpError(502,'无法读取模型列表：网络不可达、超时或服务发生跳转。请检查 API 地址。');}
    if(!response.ok){await response.body?.cancel();const code=response.status;throw httpError(502,code===401 || code===403 || code===402 || code===429?'读取模型失败：'+connectionFailure(code):code===404 || code===405?'此 API 服务未提供 /models 接口，可手动填写模型 ID。':'读取模型失败：API 返回 HTTP '+code+'。');}
    const size=Number(response.headers.get('content-length') || 0);
    if(size>2*1024*1024){await response.body?.cancel();throw httpError(502,'模型列表超过 2 MB，已停止读取。');}
    const reader=response.body?.getReader();let bytes=0;const parts=[];
    if(reader){while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2*1024*1024){await reader.cancel();throw httpError(502,'模型列表超过 2 MB，已停止读取。');}parts.push(Buffer.from(value));}}
    let json;try{json=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw httpError(502,'模型列表不是有效的 JSON。');}
    if(!Array.isArray(json?.data))throw httpError(502,'此 API 的 /models 返回格式不兼容（应包含 data 数组）。');
    const ids=new Set(),available=[];
    for(const item of json.data){
      const id=item?.id;
      if(typeof id!=='string' || !MODEL_ID.test(id) || ids.has(id))continue;
      ids.add(id);
      const display=typeof item.name==='string'?item.name:typeof item.display_name==='string'?item.display_name:id;
      const params=Array.isArray(item.supported_parameters)?item.supported_parameters:[];
      const supportsReasoning=params.includes('reasoning') || params.includes('reasoning_effort') || item.capabilities?.reasoning===true;
      available.push({id,name:display.slice(0,120),supportsReasoning});
      if(available.length>=400)break;
    }
    const result={models:available,source:baseUrl+'/models'};
    modelCache.set(cacheKey,{until:Date.now()+60000,value:result});
    if(modelCache.size>12)modelCache.delete(modelCache.keys().next().value);
    return result;
  }
  async function write(value){
    const {apiKey,...persistable}=value;
    const encryptedKey=apiKey ? await vault(apiKey):'';
    const stored={...persistable,encryptedKey,revision:randomBytes(12).toString('hex')};
    await fs.mkdir(path.dirname(file),{recursive:true});
    await fs.writeFile(file+'.tmp',JSON.stringify(stored),{mode:0o600});await fs.rename(file+'.tmp',file);
    cached={...stored,apiKey};return publicView(cached);
  }
  // Prepare without changing the saved connection, so a failed login cannot replace
  // an already working key/model. The destination always comes from the chosen provider.
  function proposedConnection(body,previous){
    if(!body || typeof body!=='object' || Array.isArray(body))throw httpError(400,'API 连接请求格式无效。');
    const baseUrl=normalizeBase(body.baseUrl);
    if(!['responses','openai'].includes(body.protocol))throw httpError(400,'请选择 Responses 或 Chat Completions。');
    if(typeof body.model!=='string' || !MODEL_ID.test(body.model))throw httpError(400,'请填写有效的模型 ID。');
    if(body.apiKey!==undefined && (typeof body.apiKey!=='string' || /[\r\n\0]/.test(body.apiKey) || body.apiKey.length>4096))throw httpError(400,'API Key 格式无效。');
    const changedOrigin=previous.baseUrl && baseUrl!==previous.baseUrl;
    if(changedOrigin && previous.apiKey && !body.apiKey?.trim() && !body.clearKey)throw httpError(400,'更换 API 地址时请重新填写该服务的 API Key，或选择清除密钥。');
    const apiKey=body.clearKey?'':body.apiKey?.trim() || (baseUrl===previous.baseUrl?previous.apiKey:'');
    const sameConnection=previous.baseUrl===baseUrl && previous.protocol===body.protocol;
    const sameModel=sameConnection && previous.model===body.model;
    const reasoningEnabled=body.reasoningEnabled===undefined?(sameConnection && previous.reasoningEnabled===true):body.reasoningEnabled;
    if(typeof reasoningEnabled!=='boolean')throw httpError(400,'推理强度开关无效。');
    const reasoningEffort=reasoningEnabled && sameModel && EFFORTS.has(previous.reasoningEffort)?previous.reasoningEffort:'';
    return {baseUrl,protocol:body.protocol,model:body.model,apiKey,reasoningEnabled,reasoningEffort};
  }
  async function save(body){
    const previous=await load();
    return write(proposedConnection(body,previous));
  }
  async function verify(value){
    if(!value.baseUrl || !value.model)throw httpError(400,'请先配置 API 模型。');
    let response;
    try{
      response=await upstream(value,value.protocol==='responses'?{input:'Reply OK.',stream:false,max_output_tokens:32}:{messages:[{role:'user',content:'Reply OK.'}],stream:false},AbortSignal.timeout(30000));
    }catch{throw httpError(502,'无法连接 API，请检查地址、网络或代理。');}
    if(!response.ok){await response.body?.cancel();return {ok:false,status:response.status,message:connectionFailure(response.status)};}
    const raw=await response.json().catch(()=>null);
    const valid=value.protocol==='responses'?raw?.object==='response' && raw.status==='completed' && Array.isArray(raw.output):Array.isArray(raw?.choices) && Boolean(raw.choices[0]?.message);
    return {ok:Boolean(valid),status:response.status,message:valid?'真实模型请求成功。':'API 返回内容与所选协议不匹配。'};
  }
  return {
    internalKey:()=>relayKey,
    status:async()=>publicView(await load()),
    models,
    disconnect(){const pending=queue.then(async()=>{
      const previous=await load();
      const result=await write({...previous,apiKey:''});
      modelCache.clear();
      return result;
    });queue=pending.catch(()=>{});return pending;},
    save(body){const pending=queue.then(()=>save(body));queue=pending.catch(()=>{});return pending;},
    connect(body){const pending=queue.then(async()=>{
      const proposed=proposedConnection(body,await load());
      if(!proposed.apiKey)throw httpError(400,'请先输入 API Key。');
      const result=await verify(proposed);
      if(!result.ok)throw httpError([401,402,403,429].includes(result.status)?result.status:502,result.message);
      return write(proposed);
    });queue=pending.catch(()=>{});return pending;},
    setEffort(body){const pending=queue.then(async()=>{
      if(!body || typeof body!=='object' || Array.isArray(body))throw httpError(400,'推理强度请求格式无效。');
      const previous=await load();
      if(!previous.baseUrl || !previous.model)throw httpError(400,'请先配置 API 模型。');
      if(body.model!==previous.model)throw httpError(409,'模型已切换，请刷新后重新设置。');
      if(body.effort!=='' && !EFFORTS.has(body.effort))throw httpError(400,'不支持的推理强度档位。');
      if(body.effort && !previous.reasoningEnabled)throw httpError(400,'请先在模型设置中开启兼容推理强度参数。');
      return write({...previous,reasoningEffort:body.effort});
    });queue=pending.catch(()=>{});return pending;},
    async resolve(origin){const value=await load();if(!value.baseUrl || !value.model)throw httpError(400,'请先保存 API 连接。');requireLocalUrl(origin);return {provider:value.protocol,connection:'direct',endpoint:origin+'/api/connection/proxy/'+value.revision+'/v1/'+(value.protocol==='responses'?'responses':'chat/completions'),model:value.model,apiKey:relayKey};},
    async check(){return verify(await load());},
    async companionChat(messages,signal){
      if(!Array.isArray(messages) || !messages.length || messages.length>21 || messages.some(m=>!m || !['user','assistant'].includes(m.role) || typeof m.content!=='string' || !m.content.trim() || m.content.length>4000) || messages.at(-1).role!=='user')throw httpError(400,'请输入 4000 字以内的问题。');
      const value=await load();if(!value.baseUrl || !value.model)throw httpError(409,'请先在 Strip Bot 设置中保存 API 连接和模型。');
      const system={role:'system',content:'你是糯糯，Strip Bot 的桌面伙伴。使用简洁友好的中文回答。你只能聊天，不能执行命令或修改文件。'};
      const history=[system,...messages.map(m=>({role:m.role,content:m.content}))];
      let response;
      try{response=await upstream(value,{stream:false,...value.protocol==='responses'?{input:history}:{messages:history}},signal);}catch{throw httpError(502,'模型连接失败，请检查 Strip Bot 的 API 配置。');}
      if(!response.ok){await response.body?.cancel();throw httpError(502,response.status===401 || response.status===403?'API 认证失败，请在 Strip Bot 中检查密钥。':response.status===429?'模型额度或请求频率受限。':'模型请求失败（HTTP '+response.status+'）。');}
      let text='';try{text=extractText(await response.json());}catch{throw httpError(502,'模型没有返回可读取的文本。');}
      if(!text.trim())throw httpError(502,'模型返回了空回复。');
      return {text:text.slice(0,16000),model:value.model};
    },
    async proxy(req,res,pathname,body){
      if(req.headers.authorization!=='Bearer '+relayKey)throw httpError(401,'无效的内部 API 转发凭据。');
      const value=await load();const expected='/api/connection/proxy/'+value.revision+'/v1/'+(value.protocol==='responses'?'responses':'chat/completions');
      if(pathname!==expected)throw httpError(409,'API 配置已变化，请新建对话。');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),600000);res.once('close',()=>controller.abort());
      try {const response=await upstream(value,body,controller.signal);res.writeHead(response.status,{'Content-Type':response.headers.get('content-type') || 'application/json','Cache-Control':'no-store'});const {pipeline}=require('node:stream/promises'),{Readable}=require('node:stream');if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();}
      catch{if(!res.headersSent)throw httpError(502,'API 请求失败，请检查网络和连接配置。');res.destroy();}finally{clearTimeout(timer);}
    },
  };
}
module.exports={createApiConnection,normalizeBase,protectKey};
