const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createEngine}=require('../backend/agent/engine.cjs');
const {createIntegrationRegistry}=require('../backend/integrations.cjs');
const {createSkillsRegistry}=require('../backend/skills.cjs');
const executable=path.resolve(__dirname,'../agent-runtime/node_modules/@opencode/cli/bin/opencode.exe');
test('real isolated OpenCode discovers an enabled Skill and connects a fixture MCP without a model request',{skip:!require('node:fs').existsSync(executable),timeout:20000},async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-mcp-engine-'));
 let engine;
 try{
  const server=path.join(root,'fixture-mcp.cjs');
  await fs.writeFile(server,`const readline=require('node:readline');readline.createInterface({input:process.stdin}).on('line',line=>{try{const req=JSON.parse(line);if(req.id===undefined)return;let result={};if(req.method==='initialize')result={protocolVersion:req.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'strip-local-fixture',version:'1.0.0'}};if(req.method==='tools/list')result={tools:[{name:'fixture_echo',description:'Local test fixture',inputSchema:{type:'object',properties:{}}}]};if(req.method==='tools/call')result={content:[{type:'text',text:'fixture'}]};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result})+'\\n');}catch{}});`);
  const registry=createIntegrationRegistry({root});await registry.upsert({id:'fixture_mcp',label:'Fixture',type:'local',command:[process.execPath,server],cwd:root});await registry.enable({id:'fixture_mcp',enabled:true,confirmed:true});
  const skills=createSkillsRegistry({root});await skills.create({name:'fixture-skill',description:'Local regression test fixture',instructions:'Test fixture only.',confirmed:true});await skills.enable({id:'fixture-skill',enabled:true,confirmed:true});
  engine=createEngine({root,executable,endpoint:'http://127.0.0.1:9/v1/chat/completions',model:'fixture'});await engine.ensure();
  let found=false,connected=false,last;
  for(let n=0;n<35;n++){
   const [s,m]=await Promise.all([engine.request('/api/skill'),engine.request('/api/mcp')]);
   found=s.data.some(x=>x.id==='fixture-skill');last=m.data;connected=m.data.some(x=>x.name==='fixture_mcp' && x.status?.status==='connected');
   if(found&&connected)break;await new Promise(r=>setTimeout(r,200));
  }
  assert.equal(found,true,'enabled skill must be discoverable');assert.equal(connected,true,'MCP must connect: '+JSON.stringify(last));
 }finally{await engine?.close();await fs.rm(root,{recursive:true,force:true});}
});
