// manual-commands-store.mjs — 手动命令的纯状态机（无 React 依赖，可直接用 node:test 测试）
// 对应旧"运行项目命令框"的 5 个缺陷：
//   1. executing 全局共享      → 状态按 session 分桶，running 以 session 维度判断
//   2. 无 pending/running 条目 → run() 立即插入 status:'running' 条目，完成后原地更新
//   3. key 不稳定              → 每条命令有单调递增 id（session 内唯一且不复用）
//   4. 常驻占用聊天区          → store 不关心渲染；UI 层改用浮动 CommandPalette（见 README）
//   5. 并发边界弱              → 集中式 in-flight 锁：同一 session 串行；跨 session 可选全局上限

export const MAX_RESULTS_PER_SESSION = 50;

export function createCommandStore({ maxConcurrent = 1, now = () => Date.now() } = {}) {
  /** @type {Map<string, {seq:number, items:Array}>} */
  const sessions = new Map();
  const inflight = new Set();          // 正在执行的 session id
  const listeners = new Set();

  function bucket(session) {
    let b = sessions.get(session);
    if (!b) { b = { seq: 0, items: [] }; sessions.set(session, b); }
    return b;
  }
  function emit() { for (const fn of listeners) fn(); }

  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    results(session) { return bucket(session).items; },
    running(session) { return inflight.has(session); },
    anyRunning() { return inflight.size > 0; },
    inflightCount() { return inflight.size; },

    /** 返回 null 表示被锁拒绝（并给出原因） */
    canRun(session, { agentRunning = false, manualRunning = false } = {}) {
      if (!session) return '会话尚未建立';
      if (inflight.has(session)) return '该会话已有命令在执行';
      if (manualRunning) return '后端正在执行上一条命令';
      if (agentRunning) return '模型正在生成，请等待完成';
      if (inflight.size >= maxConcurrent) return `最多同时执行 ${maxConcurrent} 条命令`;
      return null;
    },

    /** 立即插入 running 条目并上锁；返回条目 id */
    begin(session, command) {
      const b = bucket(session);
      const id = `${session}:${++b.seq}`;
      b.items = [...b.items, { id, session, command, status: 'running', startedAt: now(), stdout: '', stderr: '', error: null, exitCode: null, timedOut: false, truncated: false, durationMs: 0 }];
      inflight.add(session);
      emit();
      return id;
    },

    /** 完成：原地更新对应 id 的条目，释放锁 */
    finish(session, id, result) {
      const b = bucket(session);
      const startedAt = b.items.find(i => i.id === id)?.startedAt ?? now();
      b.items = b.items.map(i => i.id !== id ? i : {
        ...i, ...result,
        status: result.error ? 'failed' : result.timedOut ? 'timeout' : result.exitCode === 0 ? 'done' : 'exit',
        durationMs: result.durationMs ?? (now() - startedAt),
      });
      if (b.items.length > MAX_RESULTS_PER_SESSION) b.items = b.items.slice(-MAX_RESULTS_PER_SESSION);
      inflight.delete(session);
      emit();
    },

    /** 流式追加输出（可选） */
    append(session, id, chunk) {
      const b = bucket(session);
      b.items = b.items.map(i => i.id !== id ? i : { ...i, stdout: i.stdout + (chunk.stdout ?? ''), stderr: i.stderr + (chunk.stderr ?? '') });
      emit();
    },

    clear(session) { sessions.delete(session); inflight.delete(session); emit(); },
  };
}

/** 一次完整执行：加锁 → 插入 running → 调用 exec → 写回结果；exec 抛错也会释放锁 */
export async function runCommand(store, session, command, exec, guards) {
  const reason = store.canRun(session, guards);
  if (reason) throw new Error(reason);
  const id = store.begin(session, command);
  try {
    const result = await exec({ session, command, id });
    store.finish(session, id, result);
    return id;
  } catch (err) {
    store.finish(session, id, { error: err instanceof Error ? err.message : String(err), exitCode: null });
    throw err;
  }
}
