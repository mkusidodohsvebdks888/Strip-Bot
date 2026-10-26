'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const archive=process.env.STRIPBOT_TEST_ASAR;
test('packaged desktop ships the marketplace catalog used by its backend',{skip:!archive},()=>{
 const asar=require('../desktop-app/node_modules/@electron/asar/lib/asar.js');
 const registry=JSON.parse(asar.extractFile(path.resolve(archive),'marketplace/registry.json').toString());
 assert.equal(registry.schemaVersion,1);
 assert(Array.isArray(registry.plugins));
 assert(Array.isArray(registry.mcpServers));
 assert(registry.mcpServers.some(entry=>entry.id==='stripbot-cloud'));
 assert(asar.extractFile(path.resolve(archive),'backend/marketplace.cjs').length>0);
});
