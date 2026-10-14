'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {proxyEnvironment}=require('../backend/agent/proxy.cjs');
test('OpenCode proxy is opt-in, loopback-only and keeps local services direct',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'strip-proxy-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  assert.deepEqual(await proxyEnvironment(dir),{});
  const save=endpoint=>fs.writeFile(path.join(dir,'proxy.json'),JSON.stringify({endpoint}));
  await save('http://127.0.0.1:7890');
  const env=await proxyEnvironment(dir);
  assert.equal(env.HTTPS_PROXY,'http://127.0.0.1:7890');
  assert.equal(env.NO_PROXY,'localhost,127.0.0.1,::1,[::1]');
  assert.equal(env.https_proxy,env.HTTPS_PROXY);
  for(const endpoint of ['http://example.com:7890','http://user:secret@127.0.0.1:7890','http://127.0.0.1:7890/path']) {
    await save(endpoint);await assert.rejects(proxyEnvironment(dir));
  }
});
