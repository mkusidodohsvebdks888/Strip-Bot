'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {binary,installed}=require('../plugins/_shared.cjs');

test('dependency discovery resolves executables on a custom PATH',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-file-dependency-'));
  const previousPath=process.env.PATH;
  try{
    const command=path.join(root,process.platform==='win32'?'strip-fixture.exe':'strip-fixture');
    await fs.writeFile(command,'fixture');
    process.env.PATH=root;
    assert.equal(binary('STRIP_TEST_BINARY',[],'strip-fixture'),command);
    assert.equal(installed(command),true);
    assert.equal(installed(binary('STRIP_TEST_BINARY',[],'missing-fixture')),false);
  }finally{
    process.env.PATH=previousPath;
    await fs.rm(root,{recursive:true,force:true});
  }
});

test('file plugins report missing configured dependencies instead of appearing ready',()=>{
  for(const [id,key] of [['archive-7zip','SEVENZIP_BIN'],['office-pdf','LIBREOFFICE_BIN']]){
    const previous=process.env[key];
    try{
      process.env[key]=path.join(os.tmpdir(),'strip-missing-dependency','missing.exe');
      const status=require('../plugins/'+id+'/index.cjs').status();
      assert.equal(status.installed,false);
      assert.equal(status.command,process.env[key]);
    }finally{if(previous===undefined)delete process.env[key];else process.env[key]=previous;}
  }
});
