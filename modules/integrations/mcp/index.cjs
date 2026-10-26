'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {httpError} = require('../../core/providers/index.cjs');
const {probeRemote}=require('./probe.cjs');

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
function createIntegrationRegistry({root}) {
  const file = path.join(root, '.runtime', 'integrations.json');
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
  return {
    list: () => pending.then(read),
    async probe({id,confirmed}){
      if(confirmed!==true)throw httpError(400,'连接测试需要用户明确确认');
      const items=await pending.then(read);
      const item=items.find(entry=>entry.id===id);
      if(!item)throw httpError(404,'MCP 服务器不存在');
      return probeRemote(item);
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
    remove: ({id,confirmed}) => transaction(items => {
      if (confirmed !== true) throw httpError(400, '删除项目连接需要确认。');
      const index = items.findIndex(item=>item.id===id);
      if (index<0) throw httpError(404, '项目连接不存在。');
      items.splice(index,1);
      return {ok:true, needsReload:true};
    }),
    async asMcpServers() {
      const items = await pending.then(read);
      return Object.fromEntries(items.filter(item=>item.enabled).map(item=>[item.id, item.type==='local'
        ? {type:'local',command:item.command,...(item.cwd?{cwd:item.cwd}:{})}
        : {type:'remote',url:item.url}]));
    },
  };
}
module.exports = {createIntegrationRegistry, normalize};
