'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const file=pathToFileURL(path.join(__dirname,'..','codex-ui','src','components','api-key-provider.mjs')).href;

test('provider heuristics identify distinct key prefixes, without network access',async()=>{
  const {detectApiKeyProvider,resolveKeyProvider}=await import(file);
  assert.deepEqual(detectApiKeyProvider(' sk-proj-EXAMPLE123 '),{kind:'recognized',providerId:'openai'});
  assert.deepEqual(detectApiKeyProvider('sk-or-v1-EXAMPLE123'),{kind:'recognized',providerId:'openrouter'});
  assert.deepEqual(detectApiKeyProvider('gsk_EXAMPLE123'),{kind:'recognized',providerId:'groq'});
  assert.equal(resolveKeyProvider('sk-proj-EXAMPLE123'),'openai');
  assert.equal(resolveKeyProvider('gsk_EXAMPLE123','custom'),'custom');
});

test('shared, Google and unknown key patterns are never assigned silently',async()=>{
  const {detectApiKeyProvider,resolveKeyProvider}=await import(file);
  assert.deepEqual(detectApiKeyProvider('sk-EXAMPLEGENERIC'),{kind:'ambiguous',providerId:''});
  assert.deepEqual(detectApiKeyProvider('AIzaEXAMPLEGOOGLEKEY'),{kind:'suggested',providerId:'google'});
  assert.deepEqual(detectApiKeyProvider('customSecretExample'),{kind:'unknown',providerId:''});
  assert.deepEqual(detectApiKeyProvider(''),{kind:'empty',providerId:''});
  for(const key of ['sk-EXAMPLEGENERIC','AIzaEXAMPLEGOOGLEKEY','customSecretExample',''])assert.equal(resolveKeyProvider(key),'');
  assert.equal(resolveKeyProvider('sk-EXAMPLEGENERIC','deepseek'),'deepseek');
  assert.equal(resolveKeyProvider('AIzaEXAMPLEGOOGLEKEY','google'),'google');
});
