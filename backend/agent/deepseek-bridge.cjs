'use strict';
// Strip Bot -> Codex Responses API -> DeepSeek/compatible Chat Completions API.
// All execution permissions stay in Codex. This is ONLY a model protocol adapter.
const http = require('node:http');
const {randomBytes, timingSafeEqual, createHash} = require('node:crypto');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');

const MAX_BODY = 32 * 1024 * 1024;
const MAX_ERROR = 8192;
const MAX_TIME_MS = 10 * 60 * 1000;

function fail(status, message) { return Object.assign(new Error(message), {status}); }
function safeUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw fail(400, 'Bridge 上游 URL 无效。'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) || url.username || url.password || url.hash || url.search) {
    throw fail(400, 'Bridge 只能请求 HTTPS 或本机回环地址，且不能包含 URL 凭据。');
  }
  if (!/\/(chat\/completions|responses)\/?$/.test(url.pathname)) throw fail(400, '上游必须是 /chat/completions 或 /responses。');
  return url;
}
function secureEqual(received, expected) {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function jsonError(res, status, message) {
  if (res.headersSent) return;
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify({error: {message, type: 'bridge_error'}}));
}
async function readBody(req) {
  let total = 0; const parts = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY) throw fail(413, '请求超过 32MB 的安全上限。');
    parts.push(chunk);
  }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw fail(400, '请求不是有效 JSON。'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw fail(400, '无效的 Responses 请求。');
  return parsed;
}
function textParts(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(part => {
    if (!part || typeof part !== 'object') return '';
    if (part.type === 'input_text' || part.type === 'output_text' || part.type === 'text') return String(part.text || '');
    if (part.type === 'reasoning_text') return '';
    throw fail(422, 'Chat Completions 转换模式暂不支持图像、文件或其他多模态内容；请改用 DeepSeek 原生 Responses 模式。');
  }).join('');
}
function toolCatalog(tools=[]) {
  if(!Array.isArray(tools))throw fail(422,'tools 必须是数组。');
  const flat=[],map=new Map();
  function visit(list,namespace){for(const tool of list){
    if(tool.type==='namespace'){
      if(namespace || typeof tool.name!=='string' || !Array.isArray(tool.tools))throw fail(422,'工具命名空间格式无效。');
      visit(tool.tools,tool.name);continue;
    }
    const alias=namespace ? 'ns_'+createHash('sha256').update(namespace+'\0'+tool.name).digest('hex').slice(0,40) : tool.name;
    if(map.has(alias))throw fail(422,'工具名称重复。');
    flat.push({...tool,name:alias});map.set(alias,{name:tool.name,namespace});
  }}
  visit(tools);return {flat,map};
}
function toolAlias(name,namespace){return namespace?'ns_'+createHash('sha256').update(namespace+'\0'+name).digest('hex').slice(0,40):name;}
function restoreTool(item,map){const original=map?.get(item.name);return original?{...item,name:original.name,...(original.namespace?{namespace:original.namespace}:{})}:item;}
function convertInput(body) {
  if (body.previous_response_id) throw fail(422, 'Chat 转换模式不支持 previous_response_id；请发送完整的 input 历史。');
  const messages = [];
  if (typeof body.instructions === 'string' && body.instructions) messages.push({role: 'system', content: body.instructions});
  let input = body.input;
  if (typeof input === 'string') input = [{role: 'user', content: input}];
  if (!Array.isArray(input)) throw fail(422, 'Chat 转换模式必须传入 input 字符串或完整消息数组。');
  for (const item of input) {
    if (!item || typeof item !== 'object') throw fail(422, 'input 包含无效消息。');
    if (['system','developer','user','assistant'].includes(item.role)) {
      const role = item.role === 'developer' ? 'system' : item.role;
      messages.push({role, content: textParts(item.content)});
    } else if (item.type === 'function_call' || item.type === 'custom_tool_call') {
      if (typeof item.call_id !== 'string' || !item.call_id || !item.name) throw fail(422, '工具调用缺少 call_id 或 name。');
      let argumentsString = item.arguments;
      if (item.type === 'custom_tool_call') {
        if (item.name !== 'apply_patch') throw fail(422, 'Chat 模式仅支持 apply_patch 自定义工具。');
        argumentsString = JSON.stringify({patch: String(item.input || '')});
      }
      if (typeof argumentsString !== 'string') argumentsString = JSON.stringify(argumentsString || {});
      let last = messages.at(-1);
      if (!last || last.role !== 'assistant' || !last.tool_calls) {
        last = {role: 'assistant', content: null, tool_calls: []}; messages.push(last);
      }
      last.tool_calls.push({id: item.call_id, type: 'function', function: {name: toolAlias(item.name,item.namespace), arguments: argumentsString}});
    } else if (item.type === 'function_call_output' || item.type === 'custom_tool_call_output') {
      if (!item.call_id) throw fail(422, '工具返回内容缺少 call_id。');
      messages.push({role: 'tool', tool_call_id: item.call_id, content: textParts(item.output)});
    } else if (item.type === 'reasoning') {
      // If the caller replays plain-text reasoning, retain it for DeepSeek's
      // reasoning-aware multi-turn tool format; encrypted blobs cannot be decoded.
      const reasoning = textParts(item.content?.filter?.(part => part.type === 'reasoning_text').map(part => ({type:'text',text:part.text})) || []);
      const last = messages.at(-1);
      if (last && last.role === 'assistant' && reasoning) last.reasoning_content = (last.reasoning_content || '') + reasoning;
    } else {
      throw fail(422, `Chat 转换模式不支持输入项 ${String(item.type || 'unknown').slice(0,64)}；请使用原生 Responses。`);
    }
  }
  return messages;
}
function convertTools(tools = []) {
  return toolCatalog(tools).flat.map(tool => {
    if (tool.type === 'function') {
      if (!tool.name || typeof tool.name !== 'string') throw fail(422, '无效的函数工具名。');
      return {type:'function', function:{name:tool.name, description:tool.description || '', parameters:tool.parameters || {type:'object',properties:{}}, ...(tool.strict===undefined?{}:{strict:tool.strict})}};
    }
    if (tool.type === 'custom' && tool.name === 'apply_patch') {
      return {type:'function', function:{name:'apply_patch',description:tool.description || 'Apply a patch to project files.',parameters:{type:'object',properties:{patch:{type:'string'}},required:['patch'],additionalProperties:false}}};
    }
    throw fail(422, `Chat 转换模式无法等价转换内置工具 ${String(tool.type || 'unknown').slice(0,64)}。`);
  });
}
function convertToolChoice(choice) {
  if (!choice || typeof choice === 'string') return choice;
  if (choice.type === 'function' && choice.name) return {type:'function',function:{name:toolAlias(choice.name,choice.namespace)}};
  if (choice.type === 'custom' && choice.name === 'apply_patch') return {type:'function',function:{name:'apply_patch'}};
  throw fail(422, 'Chat 转换模式不支持此 tool_choice。');
}
function responsesToChat(body, model) {
  if (typeof body.model !== 'string' || body.model !== model) throw fail(400, '请求模型与当前 Strip Bot 连接的模型不一致。');
  const tools = convertTools(body.tools || []);
  const payload = {model, messages: convertInput(body), stream: Boolean(body.stream)};
  if (tools.length) payload.tools = tools;
  if (body.tool_choice) payload.tool_choice = convertToolChoice(body.tool_choice);
  if (Number.isInteger(body.max_output_tokens) && body.max_output_tokens > 0) payload.max_tokens = body.max_output_tokens;
  if (typeof body.temperature === 'number' && Number.isFinite(body.temperature)) payload.temperature = body.temperature;
  if (typeof body.top_p === 'number' && Number.isFinite(body.top_p)) payload.top_p = body.top_p;
  // DeepSeek thinking with tool calls requires *verbatim* reasoning_content replay;
  // Codex does not guarantee raw replay. Disable in legacy chat mode. For
  // DeepSeek reasoning use native Responses instead; never fabricate CoT.
  if (/^deepseek([\-_]|$)/i.test(model)) payload.thinking = {type:'disabled'};
  return payload;
}
function usageFromChat(usage) {
  if (!usage) return null;
  const input = Number(usage.prompt_tokens || 0), output = Number(usage.completion_tokens || 0);
  return {input_tokens:input, output_tokens:output, total_tokens:Number(usage.total_tokens ?? input+output),
    input_tokens_details:{cached_tokens:Number(usage.prompt_tokens_details?.cached_tokens || 0)},
    output_tokens_details:{reasoning_tokens:Number(usage.completion_tokens_details?.reasoning_tokens || 0)}};
}
function responseBase(model, id, created) {
  return {id,object:'response',created_at:created,status:'in_progress',error:null,incomplete_details:null,
    model,output:[],parallel_tool_calls:true,store:false,previous_response_id:null,usage:null};
}
function responseFromChat(data, model, customNames=new Set(['apply_patch']),toolMap) {
  const response = responseBase(model, 'resp_'+randomBytes(12).toString('hex'), Math.floor(Date.now()/1000));
  const choice=data?.choices?.[0];
  if (!choice?.message) throw fail(502, '上游没有返回 Chat Completions 消息。');
  const content=choice.message.content;
  if (typeof content === 'string' && content) response.output.push({id:'msg_'+randomBytes(10).toString('hex'),type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:content,annotations:[]}]});
  for (const call of choice.message.tool_calls || []) {
    if (!call.id || !call.function?.name) throw fail(502, '上游工具调用缺少名称或 call_id。');
    if (customNames.has(call.function.name)) {
      let patch;
      try {patch=JSON.parse(call.function.arguments || '{}').patch;} catch {throw fail(502, 'apply_patch 工具参数不是合法 JSON。');}
      if (typeof patch !== 'string') throw fail(502, 'apply_patch 工具参数缺少 patch 文本。');
      response.output.push({id:'ct_'+randomBytes(10).toString('hex'),type:'custom_tool_call',name:'apply_patch',call_id:call.id,input:patch,status:'completed'});
    } else {
      response.output.push(restoreTool({id:'fc_'+randomBytes(10).toString('hex'),type:'function_call',name:call.function.name,call_id:call.id,arguments:call.function.arguments || '{}',status:'completed'},toolMap));
    }
  }
  response.usage=usageFromChat(data.usage);
  if(choice.finish_reason==='length') {response.status='incomplete';response.incomplete_details={reason:'max_output_tokens'};}
  else if (choice.finish_reason==='content_filter') {response.status='incomplete';response.incomplete_details={reason:'content_filter'};}
  else response.status='completed';
  return response;
}
function emitter(res) {
  let sequence=0;
  return (type,fields={}) => {
    if (res.writableEnded || res.destroyed) return;
    const event={type,sequence_number:sequence++,...fields};
    res.write('event: '+type+'\ndata: '+JSON.stringify(event)+'\n\n');
  };
}
async function* parseSse(stream) {
  const decoder=new TextDecoder(); let pending='';
  for await (const chunk of stream) {
    pending+=decoder.decode(chunk,{stream:true});
    pending=pending.replace(/\r\n/g,'\n');
    let index;
    while ((index=pending.indexOf('\n\n'))>=0) {
      const record=pending.slice(0,index); pending=pending.slice(index+2);
      const data=record.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if (data) yield data;
    }
  }
  pending+=decoder.decode();
  if (pending.trim()) {
    const data=pending.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if (data) yield data;
  }
}
async function translateStream(upstream, res, model, customNames=new Set(['apply_patch']),toolMap) {
  const emit=emitter(res), response=responseBase(model,'resp_'+randomBytes(12).toString('hex'),Math.floor(Date.now()/1000));
  emit('response.created',{response:{...response}});
  emit('response.in_progress',{response:{...response}});
  const toolCalls=new Map(); let textItem,outputIndex=0,finished=false,finishReason='stop';
  let completeUsage=null;
  function startText() {
    if (textItem) return;
    textItem={id:'msg_'+randomBytes(10).toString('hex'),type:'message',role:'assistant',status:'in_progress',content:[]};
    const index=outputIndex++;
    textItem._index=index;
    emit('response.output_item.added',{output_index:index,item:{...textItem,content:[],_index:undefined}});
    emit('response.content_part.added',{item_id:textItem.id,output_index:index,content_index:0,part:{type:'output_text',text:'',annotations:[]}});
  }
  function appendText(text) {
    if (typeof text !== 'string' || !text) return;
    startText();textItem._text=(textItem._text||'')+text;
    emit('response.output_text.delta',{item_id:textItem.id,output_index:textItem._index,content_index:0,delta:text});
  }
  function callDelta(delta) {
    for(const part of delta || []) {
      const index=part.index;
      if (!Number.isInteger(index) || index<0 || index>100) throw fail(502,'上游返回了无效的工具索引。');
      let call=toolCalls.get(index);
      if(!call){call={index,id:part.id||'',name:part.function?.name||'',arguments:'',emitted:false};toolCalls.set(index,call);}
      if (part.id) call.id=part.id;
      if (part.function?.name) call.name=part.function.name;
      if (call.id && call.name && !call.emitted) {
        call.emitted=true;call.itemId=(customNames.has(call.name)?'ct_':'fc_')+randomBytes(10).toString('hex');call.outputIndex=outputIndex++;
        const custom=customNames.has(call.name);
        emit('response.output_item.added',{output_index:call.outputIndex,item:custom?
          {id:call.itemId,type:'custom_tool_call',name:call.name,call_id:call.id,input:'',status:'in_progress'}:
          restoreTool({id:call.itemId,type:'function_call',name:call.name,call_id:call.id,arguments:'',status:'in_progress'},toolMap)});
      }
      const fragment=part.function?.arguments || '';
      if(fragment){call.arguments+=fragment;if (call.emitted && !customNames.has(call.name)) emit('response.function_call_arguments.delta',{item_id:call.itemId,output_index:call.outputIndex,delta:fragment});}
    }
  }
  try {
    for await (const raw of parseSse(upstream.body)) {
      if(raw==='[DONE]'){finished=true;break;}
      let part;try{part=JSON.parse(raw);}catch{throw fail(502,'上游返回了不合法的 SSE JSON。');}
      if (part.error) throw fail(502,String(part.error?.message || '上游流式生成失败').slice(0,400));
      const choice=part.choices?.[0];
      if (choice?.delta?.content) appendText(choice.delta.content);
      if (choice?.delta?.tool_calls) callDelta(choice.delta.tool_calls);
      if (choice?.finish_reason) finishReason=choice.finish_reason;
      if (part.usage) completeUsage=usageFromChat(part.usage);
    }
    // A prematurely truncated upstream stream should be surfaced as failure,
    // not a successful assistant answer.
    if(!finished) throw fail(502,'上游 SSE 流未以 [DONE] 正常结束。');
    if(textItem){
      const text=textItem._text||'';
      emit('response.output_text.done',{item_id:textItem.id,output_index:textItem._index,content_index:0,text});
      emit('response.content_part.done',{item_id:textItem.id,output_index:textItem._index,content_index:0,part:{type:'output_text',text,annotations:[]}});
      const item={id:textItem.id,type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text,annotations:[]}]};
      emit('response.output_item.done',{output_index:textItem._index,item});response.output.push(item);
    }
    for (const call of [...toolCalls.values()].sort((a,b)=>a.index-b.index)) {
      if (!call.emitted) throw fail(502,'上游工具调用缺少 ID 或名称。');
      let item;
      if (customNames.has(call.name)){
        let patch;try {patch=JSON.parse(call.arguments || '{}').patch;} catch {throw fail(502,'apply_patch 参数不是有效 JSON。');}
        if(typeof patch!=='string') throw fail(502,'apply_patch 缺少 patch 文本。');
        emit('response.custom_tool_call_input.delta',{item_id:call.itemId,output_index:call.outputIndex,delta:patch});
        emit('response.custom_tool_call_input.done',{item_id:call.itemId,output_index:call.outputIndex,input:patch});
        item={id:call.itemId,type:'custom_tool_call',name:call.name,call_id:call.id,input:patch,status:'completed'};
      } else {
        emit('response.function_call_arguments.done',{item_id:call.itemId,output_index:call.outputIndex,name:call.name,arguments:call.arguments});
        item=restoreTool({id:call.itemId,type:'function_call',name:call.name,call_id:call.id,arguments:call.arguments,status:'completed'},toolMap);
      }
      emit('response.output_item.done',{output_index:call.outputIndex,item}); response.output.push(item);
    }
    response.usage=completeUsage;
    if(finishReason==='length' || finishReason==='content_filter') {
      response.status='incomplete';response.incomplete_details={reason:finishReason==='length'?'max_output_tokens':'content_filter'};
    } else response.status='completed';
    emit('response.'+response.status,{response});
  } catch(error) {
    response.status='failed';response.error={code:'upstream_error',message:String(error.message || '上游流式生成失败').slice(0,400)};
    emit('response.failed',{response});
  }
  res.end();
}
async function startBridge({upstreamUrl, upstreamKey, model, mode='chat', fetchImpl=fetch}={}) {
  const target=safeUrl(upstreamUrl);
  if (!['chat','native'].includes(mode)) throw fail(400,'Bridge 模式必须是 chat 或 native。');
  if ((mode==='chat') !== /\/chat\/completions\/?$/.test(target.pathname)) throw fail(400,'Bridge 模式与上游 URL 不匹配。');
  if (typeof upstreamKey !== 'string' || !upstreamKey) throw fail(400,'Bridge 缺少上游认证令牌。');
  if (typeof model !== 'string' || !model) throw fail(400,'Bridge 缺少模型名称。');
  const token='sb_'+randomBytes(24).toString('hex');
  const clients=new Set();let isClosing=false;
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    if (req.url==='/health' && req.method==='GET') {
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      return res.end(JSON.stringify({status:'ok',mode,model}));
    }
    if(req.url!=='/v1/responses' || req.method!=='POST')return jsonError(res,404,'Unsupported bridge route');
    if(!secureEqual(req.headers.authorization, 'Bearer '+token))return jsonError(res,401,'Bridge 身份验证失败。');
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return jsonError(res,415,'请发送 application/json。');
    const controller=new AbortController();clients.add(controller);
    const timer=setTimeout(()=>controller.abort(),MAX_TIME_MS);timer.unref?.();
    req.once('aborted',()=>controller.abort());
    res.once('close',()=>{if(!res.writableEnded)controller.abort();});
    try {
      const body=await readBody(req);
      const catalog=mode==='chat'?toolCatalog(body.tools||[]):null;
      const payload=mode==='chat'?responsesToChat(body,model):body;
      const customNames=new Set((body.tools||[]).filter(tool=>tool.type==='custom').map(tool=>tool.name));
      if(mode==='native' && body.model!==model) throw fail(400,'请求模型与 Bridge 配置不一致。');
      const upstream=await fetchImpl(target.href,{method:'POST',headers:{'Content-Type':'application/json','Accept':body.stream?'text/event-stream':'application/json',Authorization:'Bearer '+upstreamKey},body:JSON.stringify(payload),redirect:'error',signal:controller.signal});
      if(!upstream.ok){
        const upstreamText=(await upstream.text().catch(()=>'')).slice(0,MAX_ERROR);
        let detail;try{detail=JSON.parse(upstreamText)?.error?.message;}catch{}
        return jsonError(res,upstream.status>=400 && upstream.status<600?upstream.status:502,`上游 API HTTP ${upstream.status}${detail?': '+String(detail).slice(0,400):''}`);
      }
      if(mode==='native'){
        // Byte-for-byte SSE/JSON passthrough for the official DeepSeek Responses API.
        res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'});
        if(upstream.body)await pipeline(Readable.fromWeb(upstream.body),res); else res.end();
        return;
      }
      if(body.stream){
        if(!String(upstream.headers.get('content-type')||'').includes('text/event-stream')) throw fail(502,'上游没有返回流式 SSE；请检查 Chat Completions API 类型。');
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
        await translateStream(upstream,res,model,customNames,catalog.map);
      } else {
        const chat=await upstream.json().catch(()=>{throw fail(502,'上游响应不是有效 JSON。');});
        const converted=responseFromChat(chat,model,customNames,catalog.map);
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(JSON.stringify(converted));
      }
    } catch(error) {
      if(res.headersSent){if(!res.writableEnded)res.destroy();}
      else jsonError(res,Number(error.status)||502,error.name==='AbortError'?'请求超时或已取消。':error.message||'Bridge 连接失败。');
    } finally {clients.delete(controller);clearTimeout(timer);}
  });
  server.requestTimeout=MAX_TIME_MS;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}
  catch(error){throw fail(503,'无法绑定本地 Bridge 端口：'+error.message);}
  const address=server.address();
  return {baseUrl:`http://127.0.0.1:${address.port}/v1`,token,mode,model,
    async close(){if(isClosing)return;isClosing=true;for(const controller of clients)controller.abort();const closed=new Promise(resolve=>server.close(()=>resolve()));server.closeAllConnections?.();await closed;},
  };
}
module.exports={startBridge,responsesToChat,responseFromChat,convertInput,convertTools,safeUrl,translateStream};
