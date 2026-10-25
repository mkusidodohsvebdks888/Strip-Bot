const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const mod=path.resolve(__dirname,'../codex-ui/src/lib/prompt-enhancer.mjs'),modUrl=pathToFileURL(mod).href;

test('local instruction builder keeps the raw task and adds workspace context',async()=>{
  const {buildInstruction}=await import(modUrl);
  const value=buildInstruction('修复登录页', {workspace:'G:\\p\\Page07', files:['src/App.tsx']});
  assert.match(value,/## 任务\n修复登录页/);
  assert.match(value,/## 工作区\nG:\\p\\Page07/);
  assert.match(value,/## 相关文件\n- src\/App\.tsx/);
  assert.match(value,/## 要求/);
  assert.equal(buildInstruction('   '),'');
});

test('slash commands expand with Tab and filter by prefix',async()=>{
  const {expandSlash,matchSlash,SLASH_COMMANDS}=await import(modUrl);
  assert.ok(expandSlash('/fix').includes('定位根因'));
  assert.equal(expandSlash('/unknown'),null);
  assert.deepEqual(matchSlash('/f').map(item=>item.cmd),['/fix']);
  assert.equal(matchSlash('/').length,SLASH_COMMANDS.length);
  assert.deepEqual(matchSlash('普通文本'),[]);
});