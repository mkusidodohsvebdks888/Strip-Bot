const {test}=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../codex-ui/src/state/approval-preference.mjs');
test('approval selection survives reload for same project and connection only',async()=>{
  const {readApprovalPreference:read,writeApprovalPreference:write}=await load();
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  assert.equal(read(storage,'G:\\p\\one','opencode'),'ask');
  write(storage,'G:\\p\\one','opencode','allow-all');
  assert.equal(read({...storage},'g:/p/one/','opencode'),'allow-all');
  assert.equal(read(storage,'g:/p/two','opencode'),'ask');
  assert.equal(read(storage,'g:/p/one','ccswitch'),'ask');
  write(storage,'g:/p/one','opencode','ask');
  assert.equal(read(storage,'G:\\p\\one','opencode'),'ask');
});
test('invalid or unavailable saved approval mode fails closed',async()=>{
  const {readApprovalPreference:read,writeApprovalPreference:write}=await load();
  assert.equal(read({getItem:()=>'{bad'},'g:/p/one','direct'),'ask');
  const storage={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('full');}};
  assert.equal(read(storage,'g:/p/one','direct'),'ask');
  assert.throws(()=>write(storage,'g:/p/one','direct','allow-all'),/无法记住/);
  assert.throws(()=>write(storage,'','direct','allow-all'),/有效项目/);
});
