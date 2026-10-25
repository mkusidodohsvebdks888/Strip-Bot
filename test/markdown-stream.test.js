const {test}=require('node:test'),assert=require('node:assert/strict');
test('streaming markdown closes an unfinished fenced code block for rendering',async()=>{
  const {stabilizeMarkdown}=await import('../codex-ui/src/lib/markdown-stream.mjs');
  assert.equal(stabilizeMarkdown('```js\nconst x=1'),'```js\nconst x=1\n```');
  assert.equal(stabilizeMarkdown('```js\nconst x=1\n```'),'```js\nconst x=1\n```');
  assert.equal(stabilizeMarkdown('普通文本'),'普通文本');
});