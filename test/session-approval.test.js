'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createAgentService}=require('../backend/agent/service.cjs');
async function fixture(){
  const root=await fs.mkdtemp(path.resolve(__dirname,'../.runtime/approval-session-'));
  const state={pending:[],replies:[],count:0,fail:'',expired:''};
  const engine={executable:__filename,ensure:async()=>{},close:async()=>{},request:async(route,body)=>{
    if(route==='/api/session')return {data:{id:'ses_approval'+(++state.count)}};
    if(route.endsWith('/permission'))return {data:state.pending};
    if(route.endsWith('/reply')){
      const id=/permission\/(per_[^/]+)\/reply/.exec(route)[1];
      if(id===state.fail)throw Object.assign(new Error('test failure'),{status:502});
      if(id===state.expired)throw Object.assign(new Error('expired'),{status:404});
      state.replies.push({id,body});state.pending=state.pending.filter(p=>p.id!==id);return {data:{}};
    }
    if(route==='/api/session/active')return {data:{}};
    return {data:[]};
  }};
  const service=createAgentService({root,workspaceBase:root,engine,endpoint:'http://127.0.0.1:3010/v1/responses',provider:'responses',model:'test'});
  const create=options=>service.handle('POST','/sessions',{workspace:root,model:{providerID:'strip-local',id:'test'},...options});
  const a=(await create()).session.id,b=(await create()).session.id;
  return {root,state,engine,service,create,a,b,route:'/sessions/'+a};
}

test('session auto-approval is explicit, isolated, POST-only and never persisted',async()=>{
  const f=await fixture(),{service,state,route,a,b,root}=f;
  await assert.rejects(service.handle('POST',route+'/approval-mode',{mode:'allow-all'}),{status:400});
  await assert.rejects(service.handle('POST','/sessions/ses_unknown/approval-mode',{mode:'allow-all',confirmed:true}),{status:404});
  await assert.rejects(f.create({approvalMode:'allow-all'}),{status:400});
  const c=await f.create({approvalMode:'allow-all',confirmApprovalMode:true});
  assert.equal((await service.handle('GET','/sessions/'+c.session.id)).approvalMode,'allow-all');
  state.pending=[{id:'per_a',sessionID:a,action:'shell',resources:['echo a']},{id:'per_b',sessionID:b,action:'edit',resources:['b.txt']}];
  await service.handle('POST',route+'/approval-mode',{mode:'allow-all',confirmed:true});
  assert.equal((await service.handle('GET',route)).approvalMode,'allow-all');
  assert.equal((await service.handle('GET','/sessions/'+b)).approvalMode,'ask');
  assert.equal(state.replies.length,0,'GET must not execute permissions');
  await assert.rejects(service.handle('GET',route+'/approve-all'),{status:405});
  const result=await service.handle('POST',route+'/approve-all',{automatic:true,requestIDs:['per_a','per_b']});
  assert.deepEqual(result.approved,['per_a']);assert.deepEqual(state.replies,[{id:'per_a',body:{decision:'once'}}]);
  assert.deepEqual(state.pending.map(p=>p.id),['per_b']);
  assert.ok(!JSON.stringify(JSON.parse(await fs.readFile(path.join(root,'.runtime/agent-sessions.json'),'utf8'))).includes('approvalMode'));
  await service.close();
  const restarted=createAgentService({root,workspaceBase:root,engine:f.engine,engineFactory:()=>f.engine});
  assert.equal((await restarted.handle('GET',route)).approvalMode,'ask');await restarted.close();
});

test('batch approval is bounded by confirmed IDs; failures preserve partial results and stop auto mode',async()=>{
  const {service,state,route,a}=await fixture();
  state.pending=['old','new','bad','later'].map(name=>({id:'per_'+name,sessionID:a,action:'shell',resources:[name]}));
  await assert.rejects(service.handle('POST',route+'/approve-all',{requestIDs:['per_old']}),{status:400});
  const first=await service.handle('POST',route+'/approve-all',{confirmed:true,requestIDs:['per_old','per_missing']});
  assert.deepEqual(first.approved,['per_old']);assert.equal(first.approvalMode,'ask');
  assert.ok(state.pending.some(p=>p.id==='per_new'),'new requests were not part of the confirmation');
  await assert.rejects(service.handle('POST',route+'/approve-all',{automatic:true,requestIDs:['per_new']}),{status:400});
  await service.handle('POST',route+'/approval-mode',{mode:'allow-all',confirmed:true});
  state.fail='per_bad';
  const partial=await service.handle('POST',route+'/approve-all',{automatic:true,requestIDs:['per_new','per_bad','per_later']});
  assert.deepEqual(partial.approved,['per_new']);assert.equal(partial.failures[0].id,'per_bad');assert.equal(partial.approvalMode,'ask');
  assert.deepEqual(state.pending.map(p=>p.id),['per_bad','per_later']);
  state.fail='';state.expired='per_bad';
  const retry=await service.handle('POST',route+'/approve-all',{confirmed:true,requestIDs:['per_bad','per_later']});
  assert.deepEqual(retry.approved,['per_later']);assert.deepEqual(retry.failures,[]);
  assert.ok(state.replies.every(reply=>reply.body.decision==='once'));
  await service.close();
});

test('closing, stopping or rejecting disables auto mode; delayed automatic requests cannot approve',async()=>{
  const {service,state,route,a}=await fixture();
  const enable=()=>service.handle('POST',route+'/approval-mode',{mode:'allow-all',confirmed:true});
  await enable();await service.handle('POST',route+'/approval-mode',{mode:'ask'});
  await assert.rejects(service.handle('POST',route+'/approve-all',{automatic:true,requestIDs:['per_a']}),{status:400});
  await enable();await service.handle('POST',route+'/interrupt',{});
  assert.equal((await service.handle('GET',route)).approvalMode,'ask');
  state.pending=[{id:'per_a',sessionID:a,action:'read',resources:['a.txt']}];
  await enable();await service.handle('POST',route+'/permissions',{requestID:'per_a',decision:'reject'});
  assert.equal((await service.handle('GET',route)).approvalMode,'ask');
  assert.deepEqual(state.replies,[{id:'per_a',body:{decision:'reject'}}]);
  await service.close();
});
