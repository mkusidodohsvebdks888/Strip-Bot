'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {File}=require('node:buffer');
let modulePromise=import('../codex-ui/src/lib/workflow-input.mjs');
test('text attachment is UTF-8 validated and merged with explicit boundaries',async()=>{
  const {mergePrompt,estimateTokens}=await modulePromise;
  const payload=await mergePrompt('修复错误',[new File(['const a=1;'],'main.js',{type:'text/javascript'})]);
  assert.match(payload,/附件开始: main.js/);assert.match(payload,/const a=1;/);
  assert.ok(estimateTokens('Hello 你好')>0);
});
test('binary and oversized files are rejected before session creation',async()=>{
  const {mergePrompt,MAX_FILE_BYTES,MAX_PROMPT_CHARS}=await modulePromise;
  await assert.rejects(mergePrompt('hi',[new File([new Uint8Array([0,1,2])],'binary.dat')] ),/二进制/);
  await assert.rejects(mergePrompt('hi',[new File(['x'.repeat(MAX_FILE_BYTES+1)],'large.txt')]),/512 KB/);
  await assert.rejects(mergePrompt('x'.repeat(MAX_PROMPT_CHARS+1),[]),/240,000/);
  const prompt=await mergePrompt('中文',[], '历史对话');assert.match(prompt,/历史对话/);
});
