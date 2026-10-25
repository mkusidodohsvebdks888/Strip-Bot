import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInstruction, isStructuredInstruction, extractTask, expandSlash, matchSlash } from '../codex-ui/src/lib/prompt-enhancer.mjs';
import { stabilizeMarkdown, createFenceTracker } from '../codex-ui/src/lib/markdown-stream.mjs';

test('P3-8 buildInstruction 幂等：重复优化不嵌套', () => {
  const once = buildInstruction('修复登录页报错');
  const twice = buildInstruction(once);
  assert.equal(twice, once);
  assert.equal((twice.match(/## 任务/g) || []).length, 1);
});

test('P3-8 带 workspace/files 仍幂等，且能还原任务正文', () => {
  const ctx = { workspace: 'G:\\p\\Page07', files: ['a.ts', 'b.css'] };
  const once = buildInstruction('重构输入框', ctx);
  assert.equal(buildInstruction(once, ctx), once);
  assert.ok(isStructuredInstruction(once));
  assert.equal(extractTask(once), '重构输入框');
});

test('buildInstruction 空输入返回空串', () => {
  assert.equal(buildInstruction('   '), '');
});

test('斜杠命令展开与匹配', () => {
  assert.ok(expandSlash('/fix').includes('根因'));
  assert.equal(expandSlash('/nope'), null);
  assert.equal(expandSlash('/fix 不是纯命令'), null);
  assert.ok(matchSlash('/re').some(c => c.cmd === '/refactor'));
  assert.deepEqual(matchSlash('hello'), []);
});

test('stabilizeMarkdown 补齐未闭合代码块', () => {
  assert.equal(stabilizeMarkdown('a ```js\nx'), 'a ```js\nx\n```');
  assert.equal(stabilizeMarkdown('```js\nx\n```'), '```js\nx\n```');
});

test('P3-6 增量 tracker 与全量结果逐帧一致（含跨帧截断的 fence）', () => {
  const full = '前言 ```ts\nconst a = 1;\n```\n再来 ```\ncode\n```\n尾巴 ```js\nopen ``````x';
  const t = createFenceTracker();
  for (let i = 1; i <= full.length; i++) {
    const vis = full.slice(0, i);
    assert.equal(t.stabilize(vis), stabilizeMarkdown(vis), `mismatch at ${i}`);
  }
});

test('P3-6 大步长推进也一致', () => {
  const full = 'x'.repeat(50) + '```' + 'y'.repeat(7) + '```' + 'z'.repeat(5) + '`' + '``' + 'w';
  const t = createFenceTracker();
  for (let i = 1; i <= full.length; i += 7) {
    const vis = full.slice(0, i);
    assert.equal(t.stabilize(vis), stabilizeMarkdown(vis), `mismatch at ${i}`);
  }
  assert.equal(t.stabilize(full), stabilizeMarkdown(full));
});

test('P3-6 文本重置后重新统计', () => {
  const t = createFenceTracker();
  t.stabilize('```a\nb');
  assert.equal(t.stabilize('全新内容'), '全新内容');
});
