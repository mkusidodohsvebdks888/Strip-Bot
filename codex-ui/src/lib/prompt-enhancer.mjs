// prompt-enhancer.mjs v2 — 指令生成 / 指令优化
// 修复：P3-7 默认 endpoint 改为 gateway 已有的 /api/chat；P3-8 buildInstruction 幂等，不再嵌套。

const STRUCTURED_RE = /^## 任务\s*\n[\s\S]*\n## 要求\s*\n/m;

/** 文本是否已是 buildInstruction 产出的结构化指令 */
export function isStructuredInstruction(text) {
  return STRUCTURED_RE.test(String(text ?? '').trim());
}

/** 从结构化指令中取回原始任务正文 */
export function extractTask(text) {
  const m = String(text ?? '').trim().match(/^## 任务\s*\n([\s\S]*?)(?=\n## (?:工作区|相关文件|要求)\s*\n|$)/m);
  return m ? m[1].trim() : String(text ?? '').trim();
}

/** 一键把零散需求整理成结构化指令（本地、零延迟、幂等） */
export function buildInstruction(raw, ctx = {}) {
  let text = (raw || '').trim();
  if (!text) return '';
  if (isStructuredInstruction(text)) text = extractTask(text);
  const lines = ['## 任务', text];
  if (ctx.workspace) lines.push(`\n## 工作区\n${ctx.workspace}`);
  if (ctx.files?.length) lines.push(`\n## 相关文件\n${ctx.files.map(f => `- ${f}`).join('\n')}`);
  lines.push('\n## 要求');
  lines.push('- 先给出 1–3 句方案概述，再执行；涉及改动时列出受影响文件。');
  lines.push('- 代码改动以完整可粘贴的片段给出，并说明放置位置。');
  lines.push('- 不确定处先提出假设并标注，不要臆造 API。');
  lines.push('- 回答使用中文，保留代码与标识符原文。');
  return lines.join('\n');
}

export const SLASH_COMMANDS = [
  { cmd: '/explain', label: '解释代码', template: '请逐段解释下面代码的职责、数据流和潜在问题：\n\n' },
  { cmd: '/fix', label: '修复错误', template: '以下报错/现象：\n\n<粘贴报错>\n\n请定位根因并给出最小修复补丁。' },
  { cmd: '/refactor', label: '重构', template: '请在不改变行为的前提下重构下面代码，目标：可读性、复用性、类型安全。给出 diff 与理由：\n\n' },
  { cmd: '/test', label: '生成测试', template: '为下面代码生成单元测试（使用项目已有测试框架），覆盖正常、边界、异常三类用例：\n\n' },
  { cmd: '/ui', label: 'UI 优化', template: '请审阅下面组件的 UI/UX：层级、间距、动效、可访问性（焦点、对比度、reduced-motion），并给出具体 CSS/TSX 修改：\n\n' },
  { cmd: '/doc', label: '写文档', template: '为下面模块写 README 片段：用途、安装、API、示例、注意事项：\n\n' },
  { cmd: '/commit', label: '提交信息', template: '根据以下 diff 生成符合 Conventional Commits 的提交信息（中文正文）：\n\n' },
];

export function expandSlash(text) {
  const m = String(text ?? '').match(/^(\/[a-z]+)\s?$/i);
  if (!m) return null;
  const hit = SLASH_COMMANDS.find(c => c.cmd === m[1].toLowerCase());
  return hit ? hit.template : null;
}

export function matchSlash(text) {
  const m = String(text ?? '').match(/^(\/[a-z]*)$/i);
  if (!m) return [];
  return SLASH_COMMANDS.filter(c => c.cmd.startsWith(m[1].toLowerCase()));
}

const ENHANCE_SYSTEM = `你是提示词工程师。把用户的原始需求改写成一条高质量指令：
1) 保留用户全部意图与约束，不新增需求；
2) 结构：目标 / 上下文 / 输出格式 / 验收标准；
3) 使用用户的语言；只输出改写后的指令，不要解释。`;

/**
 * 调用 gateway 现有的 /api/chat 做改写。宿主可用 mapRequest / mapResponse 适配自己的格式。
 * 失败时抛错，调用方应降级到 buildInstruction()。
 */
export async function enhanceWithModel(raw, {
  endpoint = '/api/chat',
  model,
  signal,
  mapRequest = payload => payload,
  mapResponse = data => data.text ?? data.reply ?? data.content ?? data.choices?.[0]?.message?.content ?? '',
} = {}) {
  const payload = mapRequest({
    model, stream: false, temperature: 0.2, max_tokens: 800,
    messages: [{ role: 'system', content: ENHANCE_SYSTEM }, { role: 'user', content: raw }],
  });
  const res = await fetch(endpoint, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `指令优化失败（HTTP ${res.status}）`);
  const text = String(mapResponse(data) || '').trim();
  if (!text) throw new Error('指令优化返回为空');
  return text;
}
