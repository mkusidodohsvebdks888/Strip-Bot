'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {httpError}=require('../../core/providers/index.cjs');
const IDS=['archive-7zip','office-pdf'];
function createBundledPlugins({root,pluginDir=path.join(__dirname,'..','..','..','plugins')}){
  const config=path.join(root,'.runtime','bundled-plugins.json');
  let queue=Promise.resolve();
  function validate(id){if(!IDS.includes(id))throw httpError(404,'插件不存在。');return id;}
  async function read(){try{const b=await fs.readFile(config,'utf8');if(b.length>4096)throw new Error('配置过大');return JSON.parse(b);}catch(e){if(e.code==='ENOENT')return {};throw e;}}
  async function save(data){await fs.mkdir(path.dirname(config),{recursive:true});const tmp=config+'.tmp';await fs.writeFile(tmp,JSON.stringify(data),{mode:0o600});await fs.rename(tmp,config);}
  function code(id){return require(path.join(pluginDir,validate(id),'index.cjs'));}
  async function list(){
    const configState=await queue.then(read);
    return Promise.all(IDS.map(async id=>{
      try{
        const manifest=JSON.parse(await fs.readFile(path.join(pluginDir,id,'plugin.json'),'utf8'));
        return {...manifest,enabled:configState[id]===true,available:true,detail:code(id).status()};
      }catch(e){return {id,enabled:false,available:false,error:e.message};}
    }));
  }
  function enable({id,enabled,confirmed}={}){
    validate(id);
    if(typeof enabled!=='boolean'||confirmed!==true)throw httpError(400,'启停插件需明确确认。');
    const pending=queue.then(async()=>{
      await fs.access(path.join(pluginDir,id,'plugin.json'));
      const data=await read();data[id]=enabled;await save(data);
      return {ok:true,id,enabled};
    });
    queue=pending.catch(()=>{});return pending;
  }
  async function execute({id,action,input,output,confirmed}={}){
    validate(id);
    if(confirmed!==true)throw httpError(403,'执行插件需要明确确认。');
    if((await queue.then(read))[id]!==true)throw httpError(403,'插件尚未启用。');
    if(typeof input!=='string'||typeof output!=='string'||typeof action!=='string')throw httpError(400,'参数格式不正确。');
    return code(id).execute({action,input,output});
  }
  return {list,enable,execute};
}
module.exports={createBundledPlugins};
