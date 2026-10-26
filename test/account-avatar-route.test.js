'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createGateway}=require('../backend/gateway.cjs');
test('desktop gateway serves the shipped offline account avatar',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'strip-avatar-'));
 const server=createGateway({agentRoot:root,publicDir:path.join(__dirname,'../codex-ui/public')});
 try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const response=await fetch(`http://127.0.0.1:${server.address().port}/avatars/dicebear-bottts-api.svg`);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/svg\+xml/);assert.match(await response.text(),/<svg/);}
 finally{await new Promise(r=>{server.close(r);server.closeAllConnections?.();});await fs.rm(root,{recursive:true,force:true});}
});
