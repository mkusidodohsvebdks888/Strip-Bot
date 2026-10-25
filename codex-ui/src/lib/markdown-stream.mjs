// markdown-stream.mjs v2 — P3-6：增量统计 ``` 数量，避免每帧全文扫描。
// 旧 API stabilizeMarkdown(text) 保留（indexOf 比正则快，仍是全量）。
// 新 API：const t = createFenceTracker(); t.stabilize(visibleText) 每帧调用，只扫描新增部分。

export function stabilizeMarkdown(text) {
  const value = String(text ?? '');
  let fences = 0, i = 0;
  while ((i = value.indexOf('```', i)) !== -1) { fences++; i += 3; }
  return fences % 2 ? `${value}\n\`\`\`` : value;
}

export function createFenceTracker() {
  let stableEnd = 0;   // 已确定计数的前缀长度
  let fences = 0;      // 前缀内 ``` 数量
  let prefix = '';     // 已确定前缀（用于检测文本被重置）
  function reset() { stableEnd = 0; fences = 0; prefix = ''; }
  return {
    stabilize(text) {
      const value = String(text ?? '');
      if (value.length < prefix.length || !value.startsWith(prefix)) reset();
      // 末尾 2 个字符可能是半个 fence，留到下一帧；只把 [stableEnd, newEnd) 并入计数
      const newEnd = Math.max(stableEnd, value.length - 2);
      let i = stableEnd;
      while (i < newEnd) {
        const k = value.indexOf('```', i);
        if (k === -1 || k >= newEnd) break;
        fences++; i = k + 3;
      }
      // 若最后一个计入的 fence 跨过 newEnd 边界，则把 stableEnd 推到它之后，防止下一帧重复计数
      stableEnd = Math.max(newEnd, i);
      prefix = value.slice(0, stableEnd);
      const tail = value.slice(stableEnd);
      let tailFences = 0, j = 0;
      while ((j = tail.indexOf('```', j)) !== -1) { tailFences++; j += 3; }
      return (fences + tailFences) % 2 ? `${value}\n\`\`\`` : value;
    },
    reset,
  };
}
