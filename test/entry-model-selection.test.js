'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const helper=pathToFileURL(path.join(__dirname,'..','codex-ui','src','components','entry-model-selection.mjs')).href;

test('API onboarding chooses an existing preferred model only when discoverable',async()=>{
  const {pickEntryModel}=await import(helper);
  const models=[{id:'other-chat'},{id:'deepseek-chat'}];
  assert.equal(pickEntryModel(models,'deepseek-chat','old-default'),'deepseek-chat');
  assert.equal(pickEntryModel(models,'missing','deepseek-chat'),'deepseek-chat');
  assert.equal(pickEntryModel(models,'missing','also-missing'),'other-chat');
});
test('API onboarding skips non-chat model categories, and handles empty lists safely',async()=>{
  const {pickEntryModel}=await import(helper);
  assert.equal(pickEntryModel([{id:'embedding-small'},{id:'tts-1'},{id:'qwen-plus'}]),'qwen-plus');
  assert.equal(pickEntryModel([{id:'audio-realtime'}]),'audio-realtime');
  assert.equal(pickEntryModel([]),'');
  assert.equal(pickEntryModel(null),'');
});
