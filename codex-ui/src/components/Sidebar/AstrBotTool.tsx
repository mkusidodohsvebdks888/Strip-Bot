import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../Icons';
import './astrbot-tool.css';

type Service = { online: boolean; httpStatus: number | null; latencyMs: number; error: string };
type Status = {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  deployRoot: string;
  checkedAt: number;
  services: { astrbot: Service; napcat: Service };
  model: { providerId: string; model: string | null; providerName: string | null; type: string | null; apiBase: string | null; personaId: string | null };
  urls: { admin: string; napcat: string };
  configError: string;
};

async function loadStatus(): Promise<Status> {
  const response = await fetch('/api/plugins/astrbot/status', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function openLocal(url: string, onError: (message: string) => void) {
  if (!url) return;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) onError('浏览器阻止了新窗口，请允许本地页面弹窗后重试。');
}

function ServiceCard({ label, service, detail }: { label: string; service: Service; detail: string }) {
  return <div className={'strip-astrbot-service' + (service.online ? ' is-online' : '')}>
    <span className="strip-astrbot-dot" aria-hidden="true" />
    <div><strong>{label}</strong><small>{service.online ? '在线' : '离线'} · {detail}</small></div>
  </div>;
}

export function AstrBotTool() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setStatus(await loadStatus()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '读取 AstrBot 状态失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const astrbot = status?.services.astrbot;
  const napcat = status?.services.napcat;
  return <section className="strip-tool-content strip-astrbot" aria-label="AstrBot QQ 插件">
    <div className="strip-astrbot-hero"><span className="strip-astrbot-icon"><Icon name="bot" /></span><div><strong>AstrBot QQ</strong><small>QQ 消息接入 · 本地模型 · NapCat</small></div><button type="button" className="strip-astrbot-refresh" onClick={() => void refresh()} disabled={loading} title="刷新状态">{loading ? '检查中' : '刷新'}</button></div>
    <p className="strip-tool-description">在 Strip Bot 工具栏中查看 AstrBot 与 NapCat 的本地连接状态，并打开对应管理页面。插件只读取本机服务状态，不读取 QQ 聊天内容。</p>
    {error && <p className="strip-tool-error" role="alert">{error}</p>}
    {!error && <div className="strip-astrbot-services">
      <ServiceCard label="AstrBot" service={astrbot || { online: false, httpStatus: null, latencyMs: 0, error: '未检查' }} detail={astrbot?.httpStatus ? `HTTP ${astrbot.httpStatus}` : '等待检查'} />
      <ServiceCard label="NapCat / QQ" service={napcat || { online: false, httpStatus: null, latencyMs: 0, error: '未检查' }} detail={napcat?.httpStatus ? `HTTP ${napcat.httpStatus}` : '等待检查'} />
    </div>}
    <div className="strip-astrbot-model">
      <div className="strip-astrbot-section-head"><span>当前模型</span><small>{status?.model.providerId || '未连接'}</small></div>
      <strong>{status?.model.model || '未读取到模型'}</strong>
      <small>{status?.model.providerName || 'AstrBot 本地供应商'} · {status?.model.type || '未配置类型'}</small>
      {status?.model.apiBase && <code>{status.model.apiBase}</code>}
    </div>
    <div className="strip-astrbot-actions">
      <button type="button" className="strip-tool-action" onClick={() => openLocal(status?.urls.admin || '', setError)} disabled={!status}><Icon name="settings" /> 打开 AstrBot 管理后台</button>
      <button type="button" className="strip-tool-action" onClick={() => openLocal(status?.urls.napcat || '', setError)} disabled={!status}><Icon name="bot" /> 打开 NapCat 扫码页</button>
    </div>
    <div className="strip-astrbot-guide">
      <strong>QQ 使用方式</strong>
      <p>私聊直接发送消息；群聊使用 <code>@白日梦 你好</code> 或以 <code>/</code> 开头。</p>
    </div>
    <p className="strip-tool-note">服务离线时，请在部署目录运行 <code>启动.cmd</code>。插件配置路径：<code>{status?.deployRoot || 'E:\\AstrBot\\qq-ai-bot-deploy'}</code></p>
  </section>;
}