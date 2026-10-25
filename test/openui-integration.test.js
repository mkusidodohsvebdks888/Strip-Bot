'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {status,OPENUI_LOCAL_URL,OPENUI_SOURCE}=require('../modules/integrations/openui/index.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('checks only fixed loopback address without forwarding credentials',async()=>{
 let endpoint='';
 const result=await status({fetchImpl:async(url,opts)=>{
  endpoint=url;
  assert.equal(opts.method,'GET');
  assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.Authorization,undefined);
  return {status:200,headers:{get:key=>key==='content-type'?'text/html; charset=utf-8':null},text:async()=>'<html><title>OpenUI</title></html>'};
 }});
 assert.equal(endpoint,'http://127.0.0.1:7878/');
 assert.equal(OPENUI_LOCAL_URL,endpoint);
 assert.equal(result.online,true);
 assert.equal(OPENUI_SOURCE.length,40);
});
test('reports unavailable service safely',async()=>{
 const result=await status({fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(result.online,false);
});
test('integrates local generator and preserves classic theme settings',()=>{
 const app=read('codex-ui/src/App.tsx');
 const gateway=read('backend/gateway.cjs');
 const css=read('codex-ui/src/modules/theme/state/generated-theme.ts');
 const ui=read('codex-ui/src/modules/theme/components/OpenUIStudio.tsx');
 assert.ok(read('.gitmodules').includes('external/OpenUI'));
 assert.ok(app.includes('<OpenUIStudio/>'));
 assert.ok(app.includes('<WallpaperSettings'));
 assert.ok(gateway.includes("pathname==='/api/openui/status'"));
 assert.ok(gateway.includes("frame-src 'self' http://127.0.0.1:7878"));
 assert.ok(ui.includes('allow-scripts allow-forms allow-same-origin'));
 assert.ok(css.includes('const ALLOWED=new Set'));
 assert.ok(css.includes('const HEX='));
 assert.ok(!css.includes('dangerouslySetInnerHTML'));
});
