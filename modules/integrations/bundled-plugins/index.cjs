'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {httpError}=require('../../core/providers/index.cjs');
const IDS=Object.freeze(['nono-desktop','deepseek-harness-pet','archive-7zip','office-pdf']);
const LOCAL_IDS=new Set(['deepseek-harness-pet','archive-7zip','office-pdf']);

function createBundledPlugins({root,pluginDir=path.join(__dirname,'..','..','..','plugins'),nono=null}={}){
  if(!root)throw new TypeError('Bundled plugin registry requires a runtime root');
  const config=path.join(root,'.runtime','bundled-plugins.json');
  let queue=Promise.resolve();
  function validate(id){
    if(!IDS.includes(id))throw httpError(404,'插件不存在。');
    return id;
  }
  async function read(){
    try{
      const data=await fs.readFile(config,'utf8');
      if(data.length>4096)throw httpError(413,'插件状态文件过大。');
      const value=JSON.parse(data);
      if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('插件状态文件无效。');
      return value;
    }catch(error){
      if(error.code==='ENOENT')return {};
      throw error;
    }
  }
  async function save(data){
    await fs.mkdir(path.dirname(config),{recursive:true});
    const tmp=config+'.tmp';
    await fs.writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});
    await fs.rename(tmp,config);
  }
  function executable(id){
    if(!LOCAL_IDS.has(validate(id)))throw httpError(400,'此插件不能通过文件操作方式调用。');
    return require(path.join(pluginDir,id,'index.cjs'));
  }
  async function list(){
    const states=await queue.then(read);
    return Promise.all(IDS.map(async id=>{
      try{
        const meta=JSON.parse(await fs.readFile(path.join(pluginDir,id,'plugin.json'),'utf8'));
        if(meta.id!==id)throw new Error('插件清单 ID 不一致');
        if(id==='nono-desktop'){
          const current=nono?.status()||{enabled:false,running:false,state:'unavailable',supported:false};
          return {...meta,enabled:current.enabled===true,available:current.supported===true,
            runtime:{running:current.running===true,state:current.state||'stopped',error:current.error||''},
            detail:{dependency:'StripBot Electron / Windows',command:'desktop.cjs',description:'启用后使用现有糯糯桌宠服务启动和停止；不需要重复安装。'}};
        }
        const detail=await executable(id).status();
        const runtime=id==='deepseek-harness-pet'?{running:detail.running===true,state:detail.running?'running':'stopped',error:''}:undefined;
        return {...meta,enabled:states[id]===true,available:true,detail,...(runtime?{runtime}:{})};
      }catch(error){
        return {id,enabled:false,available:false,error:'插件不可用：'+error.message};
      }
    }));
  }
  function enable({id,enabled,confirmed}={}){
    validate(id);
    if(typeof enabled!=='boolean'||confirmed!==true)throw httpError(400,'启用或停用插件需要明确确认。');
    const pending=queue.then(async()=>{
      await fs.access(path.join(pluginDir,id,'plugin.json'));
      if(id==='nono-desktop'){
        if(!nono)throw httpError(503,'糯糯桌宠运行时不可用。');
        const state=await nono.setEnabled(enabled);
        return {ok:true,id,enabled:state.enabled===true,running:state.running===true};
      }
      if(id==='deepseek-harness-pet'&&!enabled)await executable(id).stop();
      const data=await read();
      data[id]=enabled;
      await save(data);
      return {ok:true,id,enabled};
    });
    queue=pending.catch(()=>{});
    return pending;
  }
  async function execute({id,action,input,output,confirmed}={}){
    validate(id);
    if(confirmed!==true)throw httpError(403,'运行插件前需要明确确认。');
    if(id==='nono-desktop')throw httpError(400,'糯糯桌宠请使用启用开关启动或停止。');
    if((await queue.then(read))[id]!==true)throw httpError(403,'请先启用插件。');
    if(typeof action!=='string')throw httpError(400,'插件操作格式错误。');
    if(id==='deepseek-harness-pet'){
      if(action!=='launch'&&action!=='stop')throw httpError(400,'Q版桌宠仅支持启动或停止。');
      return executable(id).execute({action});
    }
    if(typeof input!=='string'||typeof output!=='string')throw httpError(400,'文件插件必须提供源路径和输出路径。');
    return executable(id).execute({action,input,output});
  }
  return {list,enable,execute,ids:[...IDS]};
}
module.exports={createBundledPlugins};
