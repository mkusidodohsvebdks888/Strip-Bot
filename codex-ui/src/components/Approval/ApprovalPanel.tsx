import { useEffect, useState } from 'react';
import { Icon } from '../../Icons';
import styles from './ApprovalPanel.module.css';

export type PermissionDecision = 'once' | 'always' | 'reject';

export type PermissionRequest = {
  id: string;
  action: string;
  resources: string[];
  save?: string[];
  metadata?: unknown;
};

export type ApprovalPanelProps = {
  permissions: PermissionRequest[];
  workspace: string;
  deciding: string;
  error?: string;
  onDecision: (requestID: string, decision: PermissionDecision) => Promise<void>;
};

const OPERATION_NAMES: Record<string, string> = {
  shell: '运行终端命令',
  bash: '运行终端命令',
  read: '读取文件',
  edit: '修改文件',
  write: '写入文件',
  external_directory: '访问项目外目录',
  webfetch: '访问网页',
  websearch: '网页搜索',
  subagent: '调用子代理',
};

function detailText(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2) || '—'; }
  catch { return '无法显示操作详情'; }
}

/**
 * Approval choices use the real OpenCode permission API.
 * Always needs explicit confirmation; V2 may save project-wide rules.
 */
export function ApprovalPanel({
  permissions, workspace, deciding, error, onDecision,
}: ApprovalPanelProps) {
  const [focusedID, setFocusedID] = useState('');
  const [confirmAlways, setConfirmAlways] = useState(false);
  const index = Math.max(0, permissions.findIndex(permission => permission.id === focusedID));
  const current = permissions[index];

  useEffect(() => { setConfirmAlways(false); }, [current?.id]);

  if (!current) return null;
  const busy = Boolean(deciding);
  const savedPatterns = Array.isArray(current.save) ? current.save : [];
  const canRemember = savedPatterns.length > 0;
  const hasBroadRule = savedPatterns.some(pattern => pattern.includes('*'));
  const resources = Array.isArray(current.resources) && current.resources.length
    ? current.resources.join('\n') : '引擎未提供具体资源清单';

  return (
    <section className={styles.panel} aria-label="工具操作审批">
      <header className={styles.header}>
        <span className={styles.question} aria-hidden="true"><Icon name="circle-help" /></span>
        <div className={styles.headerText}>
          <strong>需要你的批准</strong>
          <span>Strip Bot 正在等待工具执行许可</span>
        </div>
        <span className={styles.counter}>{index + 1} / {permissions.length}</span>
        {permissions.length > 1 && (
          <div className={styles.pager} aria-label="切换待审批请求">
            <button type="button" className={styles.pageButton} aria-label="上一个请求"
              disabled={busy || index === 0}
              onClick={() => setFocusedID(permissions[index - 1].id)}>
              <Icon name="chevron-left" />
            </button>
            <button type="button" className={styles.pageButton} aria-label="下一个请求"
              disabled={busy || index === permissions.length - 1}
              onClick={() => setFocusedID(permissions[index + 1].id)}>
              <Icon name="chevron-right" />
            </button>
          </div>
        )}
      </header>
      <div className={styles.body} key={current.id}>
        <div className={styles.operation}>
          <strong>{OPERATION_NAMES[current.action] || '执行工具操作'}</strong>
          <code>{current.action}</code>
        </div>
        <pre className={styles.resources}>{resources}</pre>
        <p className={styles.workspace}>当前项目：<span>{workspace || '未提供工作区'}</span></p>

        {(current.metadata !== undefined || canRemember) && (
          <details className={styles.details}>
            <summary>查看操作参数与可保存的授权范围 <Icon name="chevron-down" /></summary>
            {current.metadata !== undefined && (
              <>
                <span className={styles.detailLabel}>工具参数</span>
                <pre className={styles.detailCode}>{detailText(current.metadata)}</pre>
              </>
            )}
            {canRemember && (
              <>
                <span className={styles.detailLabel}>引擎拟保存的匹配规则</span>
                <pre className={styles.detailCode}>{savedPatterns.join('\n')}</pre>
              </>
            )}
          </details>
        )}

        {error && <p role="alert" className={styles.error}>{error}</p>}
        {confirmAlways ? (
          <div className={styles.confirmation}>
            <strong>确认始终允许相同规则的操作？</strong>
            <p>OpenCode 将保存下方规则，后续匹配操作可能无需再次批准。V2 引擎可能按项目持久保存，而不只是当前对话。</p>
            {hasBroadRule && <p className={styles.warning}>包含通配符，授权范围可能比当前命令或文件更广。</p>}
            <pre className={styles.savedRules}>{savedPatterns.join('\n')}</pre>
            <div className={styles.actions}>
              <button type="button" className="strip-btn strip-btn--primary strip-btn--sm"
                disabled={busy} onClick={() => void onDecision(current.id, 'always')}>
                {deciding === current.id ? '正在提交…' : '确认始终允许'}
              </button>
              <button type="button" className="strip-btn strip-btn--secondary strip-btn--sm"
                disabled={busy} onClick={() => setConfirmAlways(false)}>返回</button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <button type="button" className="strip-btn strip-btn--primary strip-btn--sm"
              disabled={busy} onClick={() => void onDecision(current.id, 'once')}>
              {deciding === current.id ? '正在提交…' : '允许本次'}
            </button>
            <button type="button" className="strip-btn strip-btn--secondary strip-btn--sm"
              title={canRemember ? '查看并确认保存的匹配规则' : '引擎未提供可保存的规则，请使用“允许本次”'}
              disabled={busy || !canRemember} onClick={() => setConfirmAlways(true)}>
              始终允许同类操作
            </button>
            <button type="button" className="strip-btn strip-btn--danger strip-btn--sm"
              disabled={busy} onClick={() => void onDecision(current.id, 'reject')}>
              拒绝
            </button>
          </div>
        )}
        <p className={styles.note}>拒绝可能同时取消此会话其他待审批请求；工具始终由本机 OpenCode 执行。</p>
      </div>
    </section>
  );
}
