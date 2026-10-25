'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const issue=()=>import('../codex-ui/src/components/issue-presentation.mjs');

test('OpenCode JSON schema errors are explained without losing the original payload',async()=>{
  const {presentIssue}=await issue();
  const raw='Expected JSON value at ["data"][0]["metadata"]["include"]';
  const result=presentIssue(raw);
  assert.equal(result.title,'数据格式异常');
  assert.match(result.summary,/API 协议/);
  assert.equal(result.detail,raw);
  assert.equal(result.interrupted,false);
});

test('interruption follows a root error but should not hide the more specific cause',async()=>{
  const {presentIssue,selectRelevantIssue}=await issue();
  assert.equal(presentIssue('Step interrupted').interrupted,true);
  const entries=[{id:'root',raw:'Expected JSON value at ["data"][0]["metadata"]["include"]'},{id:'followup',raw:'Step interrupted'}];
  assert.equal(selectRelevantIssue(entries).id,'root');
  assert.equal(selectRelevantIssue([entries[1]]).id,'followup');
});

test('nested API errors and single recent errors remain human-readable',async()=>{
  const {presentIssue,issueText,selectRelevantIssue}=await issue();
  assert.equal(issueText(JSON.stringify({error:{message:'HTTP 401 Unauthorized'}})),'HTTP 401 Unauthorized');
  assert.equal(presentIssue({error:{message:'HTTP 401 Unauthorized'}}).title,'接口授权失败');
  assert.equal(selectRelevantIssue([{id:'old',raw:'old error'},{id:'new',raw:'new error'}]).id,'new');
  assert.equal(selectRelevantIssue([{id:'empty',raw:null}]),undefined);
});

test('long error messages are summarized but recoverable',async()=>{
  const {presentIssue}=await issue();
  const raw='Unknown upstream issue: '+'x'.repeat(500);
  const result=presentIssue(raw);
  assert.ok(result.summary.length<=148);
  assert.equal(result.detail,raw);
});

test('tool exit codes stay in execution activity and do not raise a global request failure',async()=>{
  const {selectTurnIssue}=await issue();
  const messages=[
    {id:'user',type:'user',content:[{type:'text',text:'查找 AstrBot'}]},
    {id:'assistant',type:'assistant',error:null,content:[
      {id:'search',type:'tool',name:'bash',state:{status:'error',error:'Exit code: 1',content:'',input:{command:'rg astrbot .'}}},
    ]},
  ];
  assert.equal(selectTurnIssue(messages,null),undefined);
  assert.equal(selectTurnIssue([{id:'assistant',type:'assistant',error:{message:'API failed'},content:[]}],null).id,'assistant');
  assert.equal(selectTurnIssue([{id:'assistant',type:'assistant',error:null,content:[]}],{message:'stream failed'}).id,'conversation');
});
