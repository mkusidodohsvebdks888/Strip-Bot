import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandStore, runCommand, MAX_RESULTS_PER_SESSION } from '../codex-ui/src/lib/manual-commands-store.mjs';

const defer = () => { let resolve, reject; const p = new Promise((r, j) => { resolve = r; reject = j; }); return { p, resolve, reject }; };

test('缺陷1：A 会话执行中不影响 B 会话', async () => {
  const s = createCommandStore({ maxConcurrent: 2 });
  const d = defer();
  const pA = runCommand(s, 'A', 'npm test', () => d.p);
  assert.equal(s.running('A'), true);
  assert.equal(s.running('B'), false);
  assert.equal(s.canRun('B'), null);
  d.resolve({ exitCode: 0, stdout: 'ok' });
  await pA;
  assert.equal(s.running('A'), false);
});

test('缺陷2：run 立即插入 running 条目，完成后原地更新', async () => {
  const s = createCommandStore();
  const d = defer();
  const p = runCommand(s, 'S', 'git status', () => d.p);
  assert.equal(s.results('S').length, 1);
  assert.equal(s.results('S')[0].status, 'running');
  d.resolve({ exitCode: 0, stdout: 'clean' });
  await p;
  assert.equal(s.results('S').length, 1);
  assert.equal(s.results('S')[0].status, 'done');
  assert.equal(s.results('S')[0].stdout, 'clean');
});

test('缺陷3：id 稳定且不复用', async () => {
  const s = createCommandStore();
  await runCommand(s, 'S', 'a', async () => ({ exitCode: 0 }));
  await runCommand(s, 'S', 'b', async () => ({ exitCode: 1 }));
  const ids = s.results('S').map(i => i.id);
  assert.deepEqual(ids, ['S:1', 'S:2']);
  assert.equal(s.results('S')[1].status, 'exit');
});

test('缺陷5：同会话串行 + 全局并发上限 + 守卫', async () => {
  const s = createCommandStore({ maxConcurrent: 1 });
  const d = defer();
  const p = runCommand(s, 'A', 'sleep', () => d.p);
  assert.match(s.canRun('A'), /已有命令/);
  assert.match(s.canRun('B'), /最多同时/);
  await assert.rejects(runCommand(s, 'B', 'x', async () => ({})), /最多同时/);
  d.resolve({ exitCode: 0 });
  await p;
  assert.match(s.canRun('A', { manualRunning: true }), /后端/);
  assert.match(s.canRun('A', { agentRunning: true }), /模型/);
  assert.equal(s.canRun('', {}), '会话尚未建立');
});

test('exec 抛错也释放锁并记录 failed', async () => {
  const s = createCommandStore();
  await assert.rejects(runCommand(s, 'S', 'boom', async () => { throw new Error('ECONN'); }), /ECONN/);
  assert.equal(s.running('S'), false);
  assert.equal(s.results('S')[0].status, 'failed');
  assert.equal(s.results('S')[0].error, 'ECONN');
});

test('timeout 状态与结果裁剪', async () => {
  const s = createCommandStore();
  await runCommand(s, 'S', 't', async () => ({ timedOut: true, exitCode: null }));
  assert.equal(s.results('S')[0].status, 'timeout');
  for (let i = 0; i < MAX_RESULTS_PER_SESSION + 5; i++) await runCommand(s, 'S', `c${i}`, async () => ({ exitCode: 0 }));
  assert.equal(s.results('S').length, MAX_RESULTS_PER_SESSION);
  assert.equal(s.results('S').at(-1).id, `S:${MAX_RESULTS_PER_SESSION + 6}`);
});

test('subscribe 在 begin/finish 时触发', async () => {
  const s = createCommandStore();
  let n = 0; const off = s.subscribe(() => n++);
  await runCommand(s, 'S', 'a', async () => ({ exitCode: 0 }));
  assert.equal(n, 2);
  off();
});
