import {useCallback, useEffect, useRef, useState} from 'react';
import type {DragEvent} from 'react';
import type {DroppedFile} from '../../lib/skills-drop.mjs';
import {Icon} from '../../Icons';
import {workspaceRequest as call, shortError} from './workspace-api';
import {collectEntries, extractDroppedPaths, filesToPayload, findSkillRoots} from '../../lib/skills-drop.mjs';
import './extension-workspace.css';
import './skills-dnd.css';

type InstalledSkill = {id: string; sourceName: string; description: string; source: string; enabled: boolean; installedAt: number};
type Zone = 'enabled' | 'library' | 'trash';
const MIME = 'application/x-strip-skill';

/**
 * Skills 面板 v2：
 *  - 两个"栏框"：已启用（Agent 可见）/ 技能库（已安装未启用）
 *  - 把系统里的 Skill 文件夹拖进任一栏框 → 导入（拖进"已启用"会在导入后询问是否立即启用）
 *  - 在两个栏框之间拖动条目 → 启用 / 停用
 *  - 拖到底部"移出"区 → 彻底移除
 *  - 仍保留"通过路径 / GitHub / 自定义"表单，作为键盘与无拖放环境的兜底
 */
export function SkillsTool() {
  const [items, setItems] = useState<InstalledSkill[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [over, setOver] = useState<Zone | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const depth = useRef(0);

  const [source, setSource] = useState<'local' | 'github' | 'create'>('local');
  const [folder, setFolder] = useState(''); const [url, setUrl] = useState(''); const [subdir, setSubdir] = useState('');
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('## 工作流程\n\n1. 分析用户需求。\n2. 根据项目文档执行任务。\n3. 检查结果并说明修改。');

  const refresh = useCallback(async () => setItems((await call<{items: InstalledSkill[]}>('/api/skills')).items), []);
  useEffect(() => { void refresh().catch(e => setError(shortError(e))); }, [refresh]);

  async function run(fn: () => Promise<unknown>, success: string, requiresReload = true) {
    setBusy(true); setError(''); setInfo('');
    try { await fn(); await refresh(); if (requiresReload) setDirty(true); setInfo(success); }
    catch (e) { setError(shortError(e)); }
    finally { setBusy(false); }
  }

  // ---------- 启停 / 移除（按钮与拖放共用） ----------
  const setEnabled = (item: InstalledSkill, next: boolean) => {
    if (item.enabled === next) return;
    if (next && !window.confirm(`确定启用 ${item.id}？它的说明将可以被 Agent 按需读取和调用。附带脚本不会自动运行，但 Agent 可能根据说明请求执行脚本。`)) return;
    void run(() => call('/api/skills/enable', {id: item.id, enabled: next, confirmed: next}), next ? '已启用，点击「应用到 Agent」。' : '已移回技能库，点击「应用到 Agent」。');
  };
  const remove = (item: InstalledSkill) => {
    if (!window.confirm(`彻底移除已安装的 Skill「${item.id}」？`)) return;
    void run(() => call('/api/skills/remove', {id: item.id, confirmed: true}), 'Skill 已移除。');
  };

  // ---------- 从系统拖入文件夹 ----------
  async function importDropped(dt: DataTransfer, zone: Zone) {
    const confirmText = '将外部 SKILL.md 和附件复制到 Strip Bot 的隔离技能库？Skills 可能指导 AI 读取文件或执行命令，请确保来源可信。';
    const desktopPath = (file: DroppedFile) => {
      const bridge = (window as unknown as {stripSkillFiles?: {getPathForFile?: (file: DroppedFile) => string}}).stripSkillFiles;
      try { return bridge?.getPathForFile?.(file) || ''; } catch { return ''; }
    };
    const paths = extractDroppedPaths(dt, desktopPath);
    const imported: InstalledSkill[] = [];
    if (paths.length) {                                    // 路径 A：拿到绝对路径
      if (!window.confirm(confirmText)) return;
      await run(async () => {
        for (const p of paths) {
          const r = await call<{item: InstalledSkill}>('/api/skills/import', {type: 'local', folder: p, subdir: '', confirmed: true});
          imported.push(r.item);
        }
      }, `已从路径导入 ${paths.length} 个 Skill。`, false);
    } else {                                               // 路径 B：只能拿到目录内容
      const {files, roots} = await collectEntries(dt.items);
      if (!files.length) { setError('未识别到文件夹。请拖入包含 SKILL.md 的目录，或改用下方"通过路径添加"。'); return; }
      const skillRoots = findSkillRoots(files.map(f => f.path));
      if (!skillRoots.length) { setError('拖入的目录里没有 SKILL.md。'); return; }
      if (skillRoots.length > 1) { setError('目录包含多个 Skill：' + skillRoots.join('、') + '。请只拖入其中一个技能目录。'); return; }
      if (!window.confirm(confirmText)) return;
      await run(async () => {
        const payload = await filesToPayload(files);
        const r = await call<{item: InstalledSkill}>('/api/skills/upload', {files: payload, subdir: skillRoots[0], label: roots[0], confirmed: true});
        imported.push(r.item);
      }, `已导入 ${roots[0]}。`, false);
    }
    if (imported.length && zone === 'enabled') imported.forEach(item => setEnabled(item, true));
  }

  // ---------- DnD 事件 ----------
  const onItemDragStart = (e: DragEvent, item: InstalledSkill) => {
    e.dataTransfer.setData(MIME, item.id); e.dataTransfer.effectAllowed = 'move'; setDragging(item.id);
  };
  const onItemDragEnd = () => { setDragging(null); setOver(null); depth.current = 0; };
  const accepts = (e: DragEvent) => Array.from(e.dataTransfer.types).some(t => t === MIME || t === 'Files' || t === 'text/uri-list');
  const zoneProps = (zone: Zone) => ({
    onDragEnter: (e: DragEvent) => { if (!accepts(e)) return; e.preventDefault(); depth.current++; setOver(zone); },
    onDragOver: (e: DragEvent) => { if (!accepts(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes(MIME) ? 'move' : 'copy'; },
    onDragLeave: () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(null); },
    onDrop: (e: DragEvent) => {
      e.preventDefault(); depth.current = 0; setOver(null);
      if (busy) return;
      const id = e.dataTransfer.getData(MIME);
      if (id) {                                            // 应用内移动
        const item = items.find(x => x.id === id); if (!item) return;
        if (zone === 'trash') remove(item); else setEnabled(item, zone === 'enabled');
        return;
      }
      if (zone === 'trash') { setError('移出区只接受已安装的 Skill。'); return; }
      void importDropped(e.dataTransfer, zone);
    },
    'data-over': over === zone || undefined,
  });

  const install = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('将外部 SKILL.md 和附件复制到 Strip Bot 的隔离技能库？Skills 可能指导 AI 读取文件或执行命令，请确保来源可信。')) return;
    void run(() => source === 'create'
      ? call('/api/skills/create', {name, description, instructions, confirmed: true})
      : call('/api/skills/import', {type: source, folder: folder.trim(), url: url.trim(), subdir: subdir.trim(), confirmed: true}),
      'Skill 已加入技能库。默认关闭，拖到「已启用」或点击启用。', false);
  };
  async function reload() {
    setBusy(true); setError(''); setInfo('');
    try { const r = await call<{message?: string}>('/api/skills/reload', {}); setDirty(false); setInfo(r.message || 'Skills 已加载到 Agent。新会话可以按需使用。'); }
    catch (e) { setError(shortError(e)); } finally { setBusy(false); }
  }

  const enabled = items.filter(x => x.enabled), library = items.filter(x => !x.enabled);
  const Card = ({item}: {item: InstalledSkill}) => (
    <article className={'strip-skill-card' + (dragging === item.id ? ' is-dragging' : '')} draggable={!busy}
      onDragStart={e => onItemDragStart(e, item)} onDragEnd={onItemDragEnd} aria-grabbed={dragging === item.id}>
      <span className="strip-skill-grip" aria-hidden="true">⋮⋮</span>
      <div className="strip-skill-body">
        <strong>{item.id}</strong>
        <p className="strip-ext-sub">{item.description}</p>
        <code className="strip-ext-mini">{item.source}</code>
      </div>
      <div className="strip-skill-actions">
        <button type="button" disabled={busy} onClick={() => setEnabled(item, !item.enabled)} title={item.enabled ? '移回技能库' : '启用'}>
          {item.enabled ? '停用' : '启用'}
        </button>
        <button type="button" disabled={busy} onClick={() => remove(item)} title="移除" aria-label={`移除 ${item.id}`}>×</button>
      </div>
    </article>
  );

  return (
    <div className="strip-tool-content strip-extension">
      <p className="strip-ext-mini">兼容基于 SKILL.md 的 Claude Code、Codex、OpenCode 技能目录。Agent 按需加载说明，不会一次塞入全部内容。</p>
      <div className="strip-ext-banner"><span className="strip-icon"><Icon name="blocks" /></span><span><strong>Agent Skills</strong><small>把技能文件夹拖进下方栏框即可添加 · 栏框之间拖动可启停 · 拖到「移出」区删除</small></span><span className="strip-ext-counter">{enabled.length}/{items.length}</span></div>

      <section className="strip-skill-zone is-enabled" {...zoneProps('enabled')} aria-label="已启用 Skills（拖入即启用）">
        <header><strong>已启用</strong><span>Agent 可见</span></header>
        {enabled.length ? enabled.map(i => <Card key={i.id} item={i} />) : <p className="strip-skill-empty">拖入技能文件夹或从下方技能库拖上来</p>}
      </section>

      <section className="strip-skill-zone is-library" {...zoneProps('library')} aria-label="技能库（已安装未启用）">
        <header><strong>技能库</strong><span>已安装 · 未启用</span></header>
        {library.length ? library.map(i => <Card key={i.id} item={i} />) : <p className="strip-skill-empty">把包含 SKILL.md 的文件夹拖到这里</p>}
      </section>

      <div className={'strip-skill-trash' + (dragging ? ' is-armed' : '')} {...zoneProps('trash')} aria-label="移出（彻底删除）">
        <Icon name="trash-bin-trash" /> 拖到这里移出
      </div>

      <div className="strip-ext-actions"><button type="button" className="is-primary strip-ext-small-action" disabled={busy} onClick={() => void reload()}><Icon name="refresh" /> 应用到 Agent {dirty ? '· 有待应用变更' : ''}</button></div>

      <details className="strip-skill-manual">
        <summary>通过路径 / GitHub / 自定义添加</summary>
        <form className="strip-ext-form" onSubmit={install}>
          <div className="strip-ext-tabs" role="tablist">
            <button type="button" aria-pressed={source === 'local'} onClick={() => setSource('local')}>本地目录</button>
            <button type="button" aria-pressed={source === 'github'} onClick={() => setSource('github')}>GitHub</button>
            <button type="button" aria-pressed={source === 'create'} onClick={() => setSource('create')}>自定义</button>
          </div>
          {source === 'local' && <><label>技能目录绝对路径</label><input value={folder} onChange={e => setFolder(e.target.value)} placeholder="D:\\skills\\my-skill" required spellCheck={false} /></>}
          {source === 'github' && <><label>公开 GitHub 仓库</label><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" required spellCheck={false} /></>}
          {source !== 'create' && <><label>技能子目录 <span>若目录下存在多个 Skill 则必填</span></label><input value={subdir} onChange={e => setSubdir(e.target.value)} placeholder="skills/my-skill" spellCheck={false} /></>}
          {source === 'create' && <>
            <label>技能标识（英文）</label><input value={name} onChange={e => setName(e.target.value)} placeholder="review-backend" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
            <label>何时使用这个 Skill</label><textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} maxLength={1024} />
            <label>执行说明（Markdown）</label><textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={8} required spellCheck={false} />
          </>}
          <button type="submit" className="strip-tool-action" disabled={busy}><Icon name="plus" /> {source === 'create' ? '创建 Skill' : '导入 Skill'}</button>
        </form>
      </details>

      {info && <p className="strip-ext-feedback">{info}</p>}
      {error && <p className="strip-ext-feedback is-error">{error}</p>}
      <p className="strip-ext-sub">启用后仍需「应用到 Agent」。读取 Skill 不等于执行代码；仓库中的 scripts、依赖与外部命令须经过 Agent 工具权限审批。</p>
    </div>
  );
}
