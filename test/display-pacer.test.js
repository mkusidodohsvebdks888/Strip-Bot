const {test}=require('node:test');
const assert=require('node:assert/strict');
test('display pacing limits only text, handles Unicode and drains after upstream completion',async()=>{
  const {DisplayPacer}=await import('../codex-ui/src/state/display-pacer.mjs');
  const pacer=new DisplayPacer('中文🙂测试',10,true);
  assert.equal(pacer.tick(.1),'中');
  assert.equal(pacer.tick(.1),'中文');
  assert.equal(pacer.tick(.1),'中文🙂');
  for(let index=0;index<5;index++)pacer.tick(.1);
  assert.equal(pacer.visible,'中文🙂测试');
  pacer.setTarget('中文🙂测试完成');assert.equal(pacer.visible,'中文🙂测试');
  pacer.setRate(null);assert.equal(pacer.visible,'中文🙂测试完成');
});
test('historical content, edits and reset never replay another message',async()=>{
  const {DisplayPacer}=await import('../codex-ui/src/state/display-pacer.mjs');
  const pacer=new DisplayPacer('历史记录',10,false);assert.equal(pacer.visible,'历史记录');
  pacer.setTarget('更正内容');assert.equal(pacer.visible,'更正内容');
  pacer.reset('另一个会话');assert.equal(pacer.visible,'另一个会话');
});
test('background timer gaps do not produce an unbounded catch-up burst',async()=>{
  const {DisplayPacer}=await import('../codex-ui/src/state/display-pacer.mjs');
  const pacer=new DisplayPacer('中'.repeat(1000),10,true);pacer.tick(60);assert.equal(pacer.visible.length,4);
});
