'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const pet=require('../plugins/deepseek-harness-pet/index.cjs');

test('packaged adapter discovers external built pet beside desktop-app',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-pet-packaged-'));
  try{
    const source=path.join(root,'桌宠','DeepSeek-Q版-dsh-pet','dsh-pet','lib','standalone.js');
    await fs.mkdir(path.dirname(source),{recursive:true});
    await fs.writeFile(source,'// compiled fixture');
    const baseDir=path.join(root,'desktop-app','releases','version','Strip Bot-win32-x64','resources','app.asar','plugins','deepseek-harness-pet');
    assert.equal(pet.resolveScript({env:{},baseDir}),source);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('Q version adapter uses configured absolute compiled standalone entry',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-pet-adapter-'));
  try{
    const source=path.join(root,'standalone.js');
    await fs.writeFile(source,'// compiled test fixture');
    const env={DSH_PET_STANDALONE_PATH:source,DSH_PET_NODE_BIN:process.execPath};
    assert.equal(pet.resolveScript({env}),source);
    assert.equal(pet.resolveScript({env:{DSH_PET_STANDALONE_PATH:'relative/standalone.js'}}),null);
    assert.equal(pet.resolveScript({env:{DSH_PET_STANDALONE_PATH:path.join(root,'unknown.js')}}),null);
    assert.equal((await pet.status({env})).installed,true);
    let spawnArgs=null;
    const spawnImpl=(exe,args,options)=>{
      assert.equal(exe,process.execPath);
      spawnArgs=args;
      assert.equal(options.shell,false);
      assert.equal(options.detached,false);
      const child=new EventEmitter();
      Object.assign(child,{killed:false,exitCode:null,signalCode:null,
        kill(signal){this.killed=true;this.signalCode=signal;this.emit('exit',0,signal);return true;}});
      process.nextTick(()=>child.emit('spawn'));
      return child;
    };
    const started=await pet.launch({env,spawnImpl});
    assert.equal(started.ok,true);
    assert.deepEqual(spawnArgs,[source,'--port','3100']);
    assert.equal((await pet.status({env})).running,true);
    assert.match((await pet.stop()).message,/关闭/);
    assert.equal((await pet.status({env})).running,false);
  }finally{
    await pet.stop();
    await fs.rm(root,{recursive:true,force:true});
  }
});
test('Q version has safe errors for unsupported actions or missing compiled entry',async()=>{
  await assert.rejects(pet.execute({action:'delete'}),/仅支持启动或停止/);
  assert.equal(pet.resolveScript({env:{DSH_PET_STANDALONE_PATH:'./standalone.js'}}),null);
  const missing=await pet.status({env:{DSH_PET_STANDALONE_PATH:path.join(os.tmpdir(),'missing-pet','standalone.js')}});
  assert.equal(missing.installed,false);
  assert.equal(missing.running,false);
});
test('upstream source is pinned and original backup remains available',()=>{
  const fsSync=require('node:fs');
  const root=path.resolve(__dirname,'..');
  const modules=fsSync.readFileSync(path.join(root,'.gitmodules'),'utf8');
  const manifest=JSON.parse(fsSync.readFileSync(path.join(root,'plugins/deepseek-harness-pet/plugin.json'),'utf8'));
  assert.match(modules,/DeepSeek-Q版-dsh-pet/);
  assert.equal(manifest.id,'deepseek-harness-pet');
  assert.equal(manifest.upstream.commit,'dfc03961bdb4d26898838cb72c9c2ac09699b1e2');
  assert.ok(fsSync.existsSync(path.join(root,'桌宠/DeepSeek-Harness-Pet/README.md')));
  assert.match(manifest.name,/Q版/);
});
