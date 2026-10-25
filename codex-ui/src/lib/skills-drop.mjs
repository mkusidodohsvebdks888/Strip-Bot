// skills-drop.mjs — 拖放 Skill 的纯逻辑（无 DOM 依赖的部分可用 node:test 测试）
// 两条路径：
//   A. 能拿到绝对路径（Electron file.path / text/uri-list file:// / 纯文本绝对路径）→ 走现有 /api/skills/import {type:'local'}
//   B. 普通浏览器只能拿到目录内容（webkitGetAsEntry）→ 读取文件并上传到 /api/skills/upload

export const MAX_SKILL_FILES = 100;
export const MAX_SKILL_BYTES = 8 * 1024 * 1024;
const SKIP = new Set(['node_modules', '__pycache__', '.git']);

/** file:///D:/skills/my-skill  →  D:\skills\my-skill ；file:///home/u/s → /home/u/s */
export function fileUriToPath(uri) {
  const m = /^file:\/\/(?:localhost)?\/(.*)$/i.exec(String(uri || '').trim());
  if (!m) return null;
  let p = decodeURIComponent(m[1]);
  if (/^[a-z]:[\/\\]/i.test(p)) return p.replace(/\//g, '\\');   // Windows 盘符
  if (/^[a-z]:$/i.test(p)) return p + '\\';
  return '/' + p;
}

export function isAbsolutePath(p) {
  return /^[a-z]:[\\\/]/i.test(p) || /^\\\\[^\\]+\\[^\\]+/.test(p) || p.startsWith('/');
}

/**
 * 从 DataTransfer 中提取绝对路径（去重，保持顺序）。
 * 传入形如 { files:[{path?}], getData(type), types:[] } 的对象即可。
 */
export function extractDroppedPaths(dt, resolvePath = null) {
  const out = [];
  const push = p => { if (p && isAbsolutePath(p) && !out.includes(p)) out.push(p); };
  for (const f of Array.from(dt?.files || [])) {
    let p = f?.path || '';
    if (!p && typeof resolvePath === 'function') { try { p = resolvePath(f) || ''; } catch {} }
    push(p);
  }
  const uris = safeGet(dt, 'text/uri-list');
  for (const line of uris.split(/\r?\n/)) if (line && !line.startsWith('#')) push(fileUriToPath(line));
  const text = safeGet(dt, 'text/plain').trim();
  if (text && !text.includes('\n')) push(text.replace(/^["']|["']$/g, ''));
  return out;
}
function safeGet(dt, type) { try { return String(dt?.getData?.(type) || ''); } catch { return ''; } }

/** 浏览器路径 B：递归读取 webkitGetAsEntry 得到的目录，返回 [{path, file}] */
export async function collectEntries(items, { maxFiles = MAX_SKILL_FILES, maxBytes = MAX_SKILL_BYTES } = {}) {
  const roots = [];
  for (const item of Array.from(items || [])) {
    const entry = item.webkitGetAsEntry?.() ?? item.getAsEntry?.();
    if (entry) roots.push(entry);
  }
  if (!roots.length) return { files: [], roots: [] };
  const files = []; let bytes = 0;
  async function walk(entry, prefix, depth) {
    if (depth > 8) throw new Error('Skill 的目录层级过深。');
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      files.push({ path: prefix + entry.name, file });
      bytes += file.size;
      if (files.length > maxFiles || bytes > maxBytes) throw new Error(`Skill 超过 ${maxFiles} 个文件或 ${Math.round(maxBytes / 1048576)} MB 限制。`);
      return;
    }
    if (entry.isDirectory) {
      if (entry.name.startsWith('.') || SKIP.has(entry.name)) return;
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const child of batch) await walk(child, prefix + entry.name + '/', depth + 1);
      } while (batch.length);
    }
  }
  for (const r of roots) await walk(r, '', 0);
  return { files, roots: roots.map(r => r.name) };
}

/** 在已收集的相对路径里找出含 SKILL.md 的目录（用于多技能仓库提示） */
export function findSkillRoots(paths) {
  return paths.filter(p => /(^|\/)SKILL\.md$/.test(p)).map(p => p.replace(/SKILL\.md$/, '').replace(/\/$/, ''));
}

/** 把 File 列表转成上传 JSON（base64）。仅文本/小文件，后端再做一次限制校验 */
export async function filesToPayload(files) {
  const out = [];
  for (const { path, file } of files) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    out.push({ path, base64: btoa(bin) });
  }
  return out;
}
