'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createBackendRegistry,inspectProject,safeLocalURL}=require('../backend/backend-projects.cjs');
const {createSkillsRegistry,parseSkill}=require('../backend/skills.cjs');
const {parseGithubUrl,inspectToolFolder,createGithubTools}=require('../backend/github-tools.cjs');
const {createGateway}=require('../backend/gateway.cjs');
const {createAgentService}=require('../backend/agent/service.cjs');
async function sandbox(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-extensions-'));try{return await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}}

test('backend inspection shows architecture, not secrets; source authorization is explicit',()=>sandbox(async root=>{
  const project=path.join(root,'my-spring-app');await fs.mkdir(path.join(project,'src'),{recursive:true});
  await fs.writeFile(path.join(project,'pom.xml'),'<dependency>spring-boot mysql-connector-j</dependency>');
  await fs.writeFile(path.join(project,'.env'),'PASSWORD=DO_NOT_RETURN_THIS_SECRET');
  await fs.writeFile(path.join(project,'.env.example'),'MYSQL_HOST=localhost\nSECRET_TOKEN=placeholder');
  await fs.writeFile(path.join(project,'src','DemoController.java'),'import org.springframework; @GetMapping("/users")');
  const result=await inspectProject(project);
  assert.ok(result.frameworks.includes('Spring Boot'));
  assert.ok(result.databases.includes('MySQL / MariaDB'));
  assert.ok(result.sampleRoutes.includes('/users'));
  assert.ok(result.envNames.includes('SECRET_TOKEN'));
  assert.ok(!JSON.stringify(result).includes('DO_NOT_RETURN_THIS_SECRET'));
  const registry=createBackendRegistry({root});
  await assert.rejects(registry.connect({path:project}),{status:400});
  const {item}=await registry.connect({path:project,label:'My Backend',confirmed:true,url:'http://127.0.0.1:8080/health'});
  assert.equal(await registry.allowed(project),true);
  assert.equal(await registry.allowed(root),false);
  assert.equal((await registry.list())[0].id,item.id);
  await assert.rejects(registry.connect({path:project,url:'http://example.org:8080',confirmed:true}),{status:400});
  await registry.remove({id:item.id,confirmed:true});assert.equal(await registry.allowed(project),false);
  assert.equal(safeLocalURL('http://localhost:8080/'),'http://localhost:8080/');
}));

test('allowed backend directory becomes a valid Agent workspace outside default root',()=>sandbox(async root=>{
  const own=path.join(root,'app'),external=path.join(root,'external-backend');await fs.mkdir(own);await fs.mkdir(external);
  const backendRegistry=createBackendRegistry({root:own});
  const requests=[];
  const engine={ensure:async()=>{},close:async()=>{},executable:__filename,request:async(route,data)=>{
    requests.push({route,data});
    if(route==='/api/session')return {data:{id:'ses_12345678'}};
    return {data:[]};
  }};
  const agent=createAgentService({root:own,workspaceBase:own,engine,backendRegistry});
  try{
    const params={workspace:external,model:{providerID:'strip-local',id:'test-model'}};
    await assert.rejects(agent.handle('POST','/sessions',params),{status:403});
    await backendRegistry.connect({path:external,confirmed:true});
    const result=await agent.handle('POST','/sessions',params);
    assert.equal(result.session.id,'ses_12345678');
    assert.equal(requests.find(x=>x.route==='/api/session').data.location.directory,external);
  }finally{await agent.close();}
}));

test('skills support local import, isolation, enable/disable, custom creation, removal',()=>sandbox(async root=>{
  const source=path.join(root,'external','review-backend');await fs.mkdir(path.join(source,'references'),{recursive:true});
  await fs.writeFile(path.join(source,'SKILL.md'),'---\nname: review-backend\ndescription: Review backend changes and APIs\n---\n\nFollow the checklist.\n');
  await fs.writeFile(path.join(source,'references','checklist.md'),'Review endpoints.');
  const registry=createSkillsRegistry({root});
  await assert.rejects(registry.import({type:'local',folder:source}),{status:400});
  await registry.import({type:'local',folder:source,confirmed:true});
  assert.equal((await registry.list())[0].enabled,false);
  await assert.rejects(fs.readFile(path.join(registry.enabledPath,'review-backend','SKILL.md')), {code:'ENOENT'});
  await registry.enable({id:'review-backend',enabled:true,confirmed:true});
  assert.match(await fs.readFile(path.join(registry.enabledPath,'review-backend','SKILL.md'),'utf8'),/checklist/);
  assert.equal(await fs.readFile(path.join(registry.enabledPath,'review-backend','references','checklist.md'),'utf8'),'Review endpoints.');
  await registry.enable({id:'review-backend',enabled:false});
  await assert.rejects(fs.access(path.join(registry.enabledPath,'review-backend')), {code:'ENOENT'});
  const created=await registry.create({name:'new-review',description:'Review backend API',instructions:'## Steps\nCheck code.',confirmed:true});
  assert.equal(created.item.id,'new-review');
  await registry.enable({id:'new-review',enabled:true,confirmed:true});
  assert.match(await fs.readFile(path.join(registry.enabledPath,'new-review','SKILL.md'),'utf8'),/name: new-review/);
  await registry.remove({id:'new-review',confirmed:true});
  assert.equal((await registry.list()).length,1);
}));

test('skill input and GitHub URLs are validated before filesystem or command work',()=>sandbox(async root=>{
  assert.equal(parseSkill('---\nname: my-skill\ndescription: Hello\n---\nbody','my-skill').id,'my-skill');
  assert.throws(()=>parseSkill('Missing frontmatter','bad'),{status:400});
  assert.throws(()=>parseGithubUrl('http://github.com/owner/repo'),{status:400});
  assert.throws(()=>parseGithubUrl('https://github.com/owner/repo/tree/main'),{status:400});
  assert.throws(()=>parseGithubUrl('https://github.com@127.0.0.1/foo/bar'),{status:400});
  const project=path.join(root,'github-mcp');await fs.mkdir(path.join(project,'dist'),{recursive:true});
  await fs.writeFile(path.join(project,'package.json'),JSON.stringify({name:'mcp-tool',dependencies:{'@modelcontextprotocol/sdk':'^1.0.0'},scripts:{build:'tsc'}}));
  await fs.writeFile(path.join(project,'dist','index.js'),'console.log("test")');
  const info=await inspectToolFolder(project);
  assert.equal(info.mcpLikely,true);assert.deepEqual(info.launch,['node',path.join(project,'dist','index.js')]);
  const registry=createGithubTools({root,clone:async(_url,target)=>{
    await fs.cp(project,target,{recursive:true});return {owner:'example',repo:'tool',sha:'abcabcabc'};
  }});
  await assert.rejects(registry.import({url:'https://github.com/example/tool'}),{status:400});
  const {item}=await registry.import({url:'https://github.com/example/tool',confirmed:true});
  assert.equal(item.label,'example/tool');assert.equal(item.mcpLikely,true);
  assert.ok(item.launch[1].endsWith(path.join('dist','index.js')));
  await registry.remove({id:item.id,confirmed:true});
  assert.deepEqual(await registry.list(),[]);
}));

test('new extension gateway routes reject cross-origin access and connect without running arbitrary code',()=>sandbox(async root=>{
  const agent={handle:async()=>({ok:true}),reloadIntegrations:async()=>({ok:true,reloaded:false}),close:async()=>{}};
  const server=createGateway({agentRoot:root,agentService:agent,accountService:{close:async()=>{}},ccSwitch:{status:async()=>({ok:true})}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const send=(route,data,origin=base)=>fetch(base+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
  try{
    assert.equal((await send('/api/skills/create',{name:'skill-1',description:'Skill',instructions:'Steps',confirmed:true},'https://attacker.com')).status,403);
    assert.equal((await send('/api/skills/create',{name:'skill-1',description:'Skill',instructions:'Steps',confirmed:true})).status,200);
    const list=await(await fetch(base+'/api/skills')).json();assert.equal(list.items[0].id,'skill-1');
    const dropped=Buffer.from('---\nname: drop-skill\ndescription: Dropped skill\n---\n\nSteps.\n').toString('base64');
    const upload=await send('/api/skills/upload',{files:[{path:'drop-skill/SKILL.md',base64:dropped}],subdir:'drop-skill',confirmed:true});
    assert.equal(upload.status,200);
    const uploaded=await upload.json();assert.equal(uploaded.item.id,'drop-skill');
    const listAfterUpload=await(await fetch(base+'/api/skills')).json();assert.equal(listAfterUpload.items.length,2);
    const project=path.join(root,'backend');await fs.mkdir(project);
    const connect=await send('/api/backend-projects/connect',{path:project,confirmed:true});assert.equal(connect.status,200);
    assert.equal((await(await fetch(base+'/api/backend-projects')).json()).items.length,1);
    assert.equal((await send('/api/github-tools/import',{url:'https://example.com/bad',confirmed:true})).status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
}));

test('GitHub analysis rejects files reached through an escaping directory junction',()=>sandbox(async root=>{
  const repo=path.join(root,'repo'),outside=path.join(root,'outside');await fs.mkdir(repo);await fs.mkdir(outside);
  await fs.writeFile(path.join(repo,'package.json'),JSON.stringify({name:'fixture',bin:'linked/server.js'}));
  await fs.writeFile(path.join(outside,'server.js'),'SECRET_OUTSIDE_REPO');
  await fs.symlink(outside,path.join(repo,'linked'),process.platform==='win32'?'junction':'dir');
  assert.deepEqual((await inspectToolFolder(repo)).launch,[]);
}));

test('failed Skill enable leaves no partially discoverable bundle',()=>sandbox(async root=>{
  const registry=createSkillsRegistry({root});await registry.create({name:'atomic-skill',description:'Fixture',instructions:'Instructions',confirmed:true});
  const stored=path.join(root,'.runtime','skills-library','atomic-skill');
  await fs.symlink(root,path.join(stored,'unsafe'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(registry.enable({id:'atomic-skill',enabled:true,confirmed:true}),{status:422});
  await assert.rejects(fs.access(path.join(registry.enabledPath,'atomic-skill')),{code:'ENOENT'});
  assert.equal((await registry.list())[0].enabled,false);
}));
