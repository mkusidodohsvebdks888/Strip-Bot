'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync(__dirname+'/registry.json','utf8'));
assert.equal(data.schemaVersion,1);
assert(Array.isArray(data.plugins)&&Array.isArray(data.mcpServers));
const ids=new Set();
for(const [kind,entries] of [['plugin',data.plugins],['mcp',data.mcpServers]]){
 for(const item of entries){
  assert(/^[a-z][a-z0-9-]{1,63}$/.test(item.id),'Invalid id');
  assert(!ids.has(item.id),'Duplicate id');ids.add(item.id);
  for(const field of ['name','version','description','repository'])assert(typeof item[field]==='string'&&item[field].length>0,'Missing '+field);
  assert(/^https:\/\/github\.com\//.test(item.repository),'Repository must use GitHub HTTPS');
  if(kind==='plugin')assert(/^https:\/\//.test(item.manifest),'Manifest must use HTTPS');
  else{assert.equal(item.transport,'streamable-http');assert(/^https:\/\//.test(item.endpoint),'MCP endpoint must use HTTPS');assert(['public-read','authenticated'].includes(item.access));}
 }
}
console.log('Marketplace registry valid:',ids.size,'entries');
