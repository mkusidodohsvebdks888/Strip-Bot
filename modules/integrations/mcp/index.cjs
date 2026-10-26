'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {httpError} = require('../../core/providers/index.cjs');
const {probeRemote}=require('./probe.cjs');
const {probeStdio}=require('./stdio-probe.cjs');
const serviceControl=require('./service-control.cjs');
const {CLOUD_ID,CLOUD_URL,READ_TOOL,isCloud,createCloudClient}=require('./cloud-client.cjs');

const ID_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;
const MAX_INTEGRATIONS = 30;
function normalize(raw, {previous = null, allowEnabled = false} = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw httpError(400, '集成配置应为对象。');
  const id = String(raw.id || '').trim();
  if (!ID_PATTERN.test(id)) throw httpError(400, '项目标识需要 2-40 位小写字母、数字、_ 或 -，且以字母开头。');
  const label = String(raw.label || id).trim();
  if (!label || label.length > 64) throw httpError(400, '项目名称长度必须在 1-64 字符之间。');
  if (!['local', 'remote'].includes(raw.type)) throw httpError(400, '仅支持本地 MCP 命令或远程 MCP 地址。');
  const result = {id, label, type: raw.type, enabled:allowEnabled ? raw.enabled === true : false};
  if (raw.type === 'local') {
    if (!Array.isArray(raw.command) || raw.command.length < 1 || raw.command.length > 30 || !raw.command.every(s=>typeof s === 'string' && s.trim() && !s.includes('\0') && s.length < 2048) || raw.command.join('').length > 8192) {
      throw httpError(400, '本地 MCP 启动命令必须是非空字符串数组，例如 ["node", "D:\\projects\\foo\\mcp.js"]。');
    }
    result.command = raw.command;
    if (raw.cwd !== undefined && raw.cwd !== '') {
      if (typeof raw.cwd !== 'string' || raw.cwd.length > 1024 || !path.isAbsolute(raw.cwd)) throw httpError(400, '工作目录必须使用绝对路径。');
      result.cwd = raw.cwd;
    }
  } else {
    if (typeof raw.url !== 'string' || raw.url.length > 2048) throw httpError(400, '请输入 MCP Streamable HTTP URL。');
    let url;
    try {url = new URL(raw.url);} catch {throw httpError(400, 'MCP URL 格式无效。');}
    if (url.username || url.password || url.hash || !['http:', 'https:'].includes(url.protocol)) throw httpError(400, 'MCP URL 不支持嵌入密码、片段或非 HTTP 协议。');
    if (url.protocol === 'http:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname.toLowerCase())) throw httpError(400, '非本机远程 MCP 请使用 HTTPS。');
    result.url = url.href;
  }
  if (!allowEnabled && previous && previous.type === result.type && JSON.stringify(previous.command || []) === JSON.stringify(result.command || []) && previous.url === result.url && previous.cwd === result.cwd) result.enabled = previous.enabled === true;
  return result;
}
function createIntegrationRegistry({root,cloudClient=createCloudClient()}) {
  const file = path.join(root, '.runtime', 'integrations.json');
  const permissionsFile = path.join(root, '.runtime', 'mcp-permissions.json');
  const approvalRequests = new Map();
  const cloudCredentials=new Map();
  const cloudAuditFile=path.join(root,'.runtime','mcp-cloud-audit.jsonl');
  const APPROVAL_TTL_MS = 120000;
  const MAX_APPROVALS = 50;
  const {randomUUID} = require('node:crypto');
  let pending = Promise.resolve();
  async function read() {
    try {
      const stat = await fs.stat(file);
      if (stat.size > 262144) throw httpError(413, '集成配置文件过大。');
      const raw = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!Array.isArray(raw) || raw.length > MAX_INTEGRATIONS) throw new Error('Invalid integration registry');
      return raw.map(item => normalize(item,{allowEnabled:true}));
    } catch(error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  async function write(items) {
    await fs.mkdir(path.dirname(file), {recursive:true});
    const tmp = file+'.tmp';
    await fs.writeFile(tmp, JSON.stringify(items,null,2), {mode:0o600});
    await fs.rename(tmp,file);
  }
  function transaction(work) {
    const outcome = pending.then(async()=>{
      const items = await read();
      const result = await work(items);
      await write(items);
      return result;
    });
    pending = outcome.catch(()=>{});
    return outcome;
  }
  async function readPermissions(){
    try{const stat=await fs.stat(permissionsFile);if(stat.size>262144)throw httpError(413,'权限文件过大');const data=JSON.parse(await fs.readFile(permissionsFile,'utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw httpError(500,'权限文件格式错误');return data;}
    catch(error){if(error.code==='ENOENT')return {};throw error;}
  }
  async function writePermissions(data){await fs.mkdir(path.dirname(permissionsFile),{recursive:true});const temp=permissionsFile+'.tmp';await fs.writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await fs.rename(temp,permissionsFile);}
  async function auditCloud(action,outcome){
    const record={at:new Date().toISOString(),requestId:randomUUID(),server:CLOUD_ID,action,outcome};
    try{
      await fs.mkdir(path.dirname(cloudAuditFile),{recursive:true});
      await fs.appendFile(cloudAuditFile,JSON.stringify(record)+'\n',{mode:0o600});
    }catch{} // Audit never contains tokens, arguments or tool results.
  }
  async function cloudOperation(action,operation){
    try{const result=await operation();await auditCloud(action,'ok');return result;}
    catch(error){await auditCloud(action,'failed');throw error;}
  }
  return {
    list: () => pending.then(read),
    async cloudStatus(){
      const current=(await pending.then(read)).find(item=>isCloud(item));
      return {registered:!!current,enabled:current?.enabled===true,credentialsLoaded:cloudCredentials.has(CLOUD_ID),url:CLOUD_URL,authentication:'session-only'};
    },
    async connectCloud({token,confirmed}={}){
      if(confirmed!==true)throw httpError(400,'请确认连接 StripBot Cloud');
      if(typeof token!=='string'||token.length<24||token.length>512||/[\r\n]/.test(token))throw httpError(400,'请填写 Render 中生成的有效 Token（至少24位）');
      return cloudOperation('connect',async()=>{
        const result=await transaction(async items=>{
          const index=items.findIndex(item=>item.id===CLOUD_ID);
          if(index>=0&&!isCloud(items[index]))throw httpError(409,'stripbot_cloud 标识已被其他 MCP 服务占用');
          const item=normalize({id:CLOUD_ID,label:'StripBot Cloud（Render）',type:'remote',url:CLOUD_URL,enabled:true},{allowEnabled:true});
          if(index>=0)items.splice(index,1,item);else{
            if(items.length>=MAX_INTEGRATIONS)throw httpError(400,'最多连接 30 个项目');
            items.push(item);
          }
          const policies=await readPermissions();
          policies[CLOUD_ID]={...(policies[CLOUD_ID]||{}),[READ_TOOL]:policies[CLOUD_ID]?.[READ_TOOL]||'allow'};
          await writePermissions(policies);
          return {ok:true,id:CLOUD_ID,enabled:true,credentialsLoaded:true,connected:null,message:'连接设置已保存；请测试握手以验证 Token。Token 仅保留在当前进程内存。'};
        });
        cloudCredentials.set(CLOUD_ID,token);
        return result;
      });
    },
    async permissions({id}){
      const items=await pending.then(read);
      if(!items.some(item=>item.id===id))throw httpError(404,'MCP 服务器不存在');
      const data=await readPermissions();return {id,tools:data[id]||{}};
    },
    async setPermission({id,tool,mode}){
      if(typeof tool!=='string'||!tool.trim()||tool.length>128||!['allow','ask','deny'].includes(mode))throw httpError(400,'工具名称或权限模式无效');
      return transaction(async items=>{
        if(!items.some(item=>item.id===id))throw httpError(404,'MCP 服务器不存在');
        const data=await readPermissions();
        data[id]={...(data[id]||{}),[tool]:mode};
        await writePermissions(data);
        return {ok:true,id,tool,mode};
      });
    },
    async evaluatePermission({id,tool}){
      if(typeof id!=='string'||!ID_PATTERN.test(id)||typeof tool!=='string'||!tool.trim()||tool.length>128)throw httpError(400,'MCP 工具标识无效');
      const items=await pending.then(read);
      const item=items.find(entry=>entry.id===id);
      if(!item)return {id,tool,mode:'deny',allowed:false,reason:'server_missing'};
      if(!item.enabled)return {id,tool,mode:'deny',allowed:false,reason:'server_disabled'};
      const data=await readPermissions();
      const configured=data[id]&&Object.hasOwn(data[id],tool)?data[id][tool]:data[id]?.['*']||'ask';
      const mode=['allow','ask','deny'].includes(configured)?configured:'deny';
      return {id,tool,mode,allowed:mode==='allow',reason:mode==='deny'?'denied':mode==='ask'?'approval_required':'permitted'};
    },
    async requestApproval({id,tool}){
      const decision=await this.evaluatePermission({id,tool});
      if(decision.reason!=='approval_required')return {...decision,requestId:null};
      const now=Date.now();
      for(const [key,value] of approvalRequests)if(value.expiresAt<=now)approvalRequests.delete(key);
      if(approvalRequests.size>=MAX_APPROVALS)throw httpError(429,'待处理批准请求过多');
      const requestId=randomUUID();
      approvalRequests.set(requestId,{id,tool,expiresAt:now+APPROVAL_TTL_MS});
      return {...decision,requestId,expiresAt:now+APPROVAL_TTL_MS};
    },
    async decideApproval({requestId,allow}){
      if(typeof requestId!=='string'||typeof allow!=='boolean')throw httpError(400,'批准参数无效');
      const pendingRequest=approvalRequests.get(requestId);
      if(!pendingRequest)throw httpError(404,'批准请求不存在或已处理');
      approvalRequests.delete(requestId);
      if(pendingRequest.expiresAt<=Date.now())throw httpError(410,'批准请求已过期');
      const current=await this.evaluatePermission(pendingRequest);
      if(current.reason!=='approval_required')return {ok:false,allowed:false,reason:'policy_changed'};
      return {ok:true,allowed:allow,id:pendingRequest.id,tool:pendingRequest.tool,reason:allow?'user_approved':'user_denied',note:'批准决定仅适用于当前请求，不会自动开放整个 MCP 服务器。'};
    },
    async callService({id,tool,arguments:args,confirmed}){
      if(confirmed!==true)throw httpError(400,'调用业务工具需要明确确认');
      if(typeof tool!=='string'||!tool.trim()||tool.length>128)throw httpError(400,'工具名称无效');
      if(serviceControl.isCodeTool(tool))throw httpError(403,'服务控制不允许代码或系统操作');
      const items=await pending.then(read);
      const item=items.find(entry=>entry.id===id);
      if(!item||!item.enabled)throw httpError(403,'MCP 服务不存在或未启用');
      const stored=await readPermissions();
      if(stored[id]?.[tool]!=='allow')throw httpError(403,'服务控制要求明确逐项授权；通配符权限不适用');
      const permission=await this.evaluatePermission({id,tool});
      if(!permission.allowed)throw httpError(403,'请先为该业务工具设置允许权限');
      if(item.type==='remote'){
        if(!isCloud(item)||tool!==READ_TOOL)throw httpError(403,'远程 MCP 仅允许预设的只读状态工具');
        const token=cloudCredentials.get(CLOUD_ID);
        if(!token)throw httpError(401,'请在插件页面重新填写 Render Token');
        return cloudOperation('service_status',async()=>({ok:true,id,tool,result:await cloudClient.call(token,tool,args||{})}));
      }
      if(item.type!=='local')throw httpError(403,'此 MCP 服务类型不能执行工具');
      return {ok:true,id,tool,result:await serviceControl.invoke(item,tool,args||{})};
    },
    async probe({id,confirmed}){
      if(confirmed!==true)throw httpError(400,'连接测试需要用户明确确认');
      const items=await pending.then(read);
      const item=items.find(entry=>entry.id===id);
      if(!item)throw httpError(404,'MCP 服务器不存在');
      if(isCloud(item)){
        if(!item.enabled)throw httpError(403,'请先启用 StripBot Cloud');
        const token=cloudCredentials.get(CLOUD_ID);
        if(!token)throw httpError(401,'请在插件页面填写 Render Token；密钥不会保存到磁盘');
        return cloudOperation('probe',()=>cloudClient.probe(token));
      }
      return item.type==='local'?probeStdio(item):probeRemote(item);
    },
    async inspect({id}) {
      const items=await pending.then(read);
      const item=items.find(entry=>entry.id===id);
      if(!item)throw httpError(404,'MCP 服务器不存在。');
      const checks=[];
      if(item.type==='local'){
        const executable=item.command[0];
        checks.push({name:'启动命令',ok:true,message:`已配置 ${item.command.length} 个命令参数`});
        if(item.cwd){
          try{const stat=await fs.stat(item.cwd);checks.push({name:'工作目录',ok:stat.isDirectory(),message:stat.isDirectory()?'目录存在':'路径不是目录'});}
          catch{checks.push({name:'工作目录',ok:false,message:'工作目录不存在或不可访问'});}
        }
        checks.push({name:'进程启动',ok:null,message:`尚未启动 ${path.basename(executable)}；需要独立的 MCP 握手测试`});
      }else{
        const target=new URL(item.url);
        checks.push({name:'URL 格式',ok:true,message:`${target.protocol}//${target.host}`});
        checks.push({name:'协议握手',ok:null,message:'尚未发起网络连接；此处仅验证已保存配置'});
      }
      return {id:item.id,type:item.type,configured:true,connected:null,checks};
    },
    upsert: raw => transaction(items => {
      if(raw?.id===CLOUD_ID)throw httpError(409,'云端 MCP 请使用专用的安全连接入口');
      const existing = items.findIndex(item=>item.id===raw?.id);
      if (existing<0 && items.length >= MAX_INTEGRATIONS) throw httpError(400, '最多连接 30 个项目。');
      const item = normalize(raw, {previous:existing>=0?items[existing]:null});
      if (existing>=0)items.splice(existing,1,item);else items.push(item);
      return {ok:true, item, needsReload:true};
    }),
    enable: ({id,enabled,confirmed}) => transaction(items => {
      const item = items.find(item=>item.id===id);
      if (!item) throw httpError(404, '项目连接不存在。');
      if (typeof enabled !== 'boolean' || (enabled && confirmed !== true)) throw httpError(400, '启用项目工具需要用户明确确认。');
      item.enabled = enabled;
      return {ok:true, item, needsReload:true};
    }),
    async remove({id,confirmed}){
      const result=await transaction(items=>{
        if (confirmed !== true) throw httpError(400, '删除项目连接需要确认。');
        const index = items.findIndex(item=>item.id===id);
        if (index<0) throw httpError(404, '项目连接不存在。');
        items.splice(index,1);
        return {ok:true, needsReload:true};
      });
      if(id===CLOUD_ID)cloudCredentials.delete(CLOUD_ID);
      return result;
    },
    async asMcpServers() {
      const items = await pending.then(read);
      const policies=await readPermissions();
      // Codex currently has no per-MCP-tool interception in this adapter.
      // Never expose an entire server unless its explicit wildcard policy permits every tool.
      return Object.fromEntries(items.filter(item=>item.id!==CLOUD_ID && item.enabled && policies[item.id]?.['*']==='allow' && Object.entries(policies[item.id]).every(([tool,mode])=>tool==='*'||mode==='allow')).map(item=>[item.id, item.type==='local'
        ? {type:'local',command:item.command,...(item.cwd?{cwd:item.cwd}:{})}
        : {type:'remote',url:item.url}]));
    },
  };
}
module.exports = {createIntegrationRegistry, normalize};
