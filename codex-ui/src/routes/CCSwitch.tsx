import { useCallback, useEffect, useState } from 'react';
import {
  extractResponseText,
  inspectCcSwitch,
  isCcSwitchEnabled,
  sendCcSwitchResponse,
  setCcSwitchEnabled,
  type CcSwitchStatus,
} from '../integrations/ccswitch';
import styles from './CCSwitch.module.css';

export function CCSwitchPage({onChange,onBack,disabled=false}:{onChange:(enabled:boolean,model:string) => void;onBack:() => void;disabled?:boolean}) {
  const [enabled, setEnabled] = useState(isCcSwitchEnabled());
  const [status, setStatus] = useState<CcSwitchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelOverride, setModelOverride] = useState(() => localStorage.getItem('strip.ccswitch.model.v1') || '');
  const [prompt, setPrompt] = useState('请用一句话确认 Strip 已连接 CC Switch。');
  const [answer, setAnswer] = useState('');
  const [testing, setTesting] = useState(false);
  const [verifiedModel,setVerifiedModel] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    setVerifiedModel('');
    try {
      const data = await inspectCcSwitch();
      setStatus(data);
      // The model defaults to the current Codex route on every send. A typed value overrides it.
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = (checked: boolean) => {
    setEnabled(checked);
    setCcSwitchEnabled(checked);
    onChange(checked,modelOverride.trim());
  };

  const test = async () => {
    if (!prompt.trim() || !enabled || !status?.reachable) return;
    setTesting(true);
    setAnswer('');
    setError('');
    try {
      const response = await sendCcSwitchResponse(prompt, modelOverride.trim() || undefined);
      const text = extractResponseText(response);
      if (!text) throw new Error('接口未返回文本，尚未通过模型调用验证。');
      setAnswer(text);setVerifiedModel(modelOverride.trim() || status.codex.model || '');
    } catch (e) { setVerifiedModel('');setError(e instanceof Error ? e.message : String(e)); }
    finally { setTesting(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <button onClick={onBack} className={styles.back}>← 返回 Strip</button>
        <h1>CC Switch 连接</h1>
        <p>通过 Strip 本机后端连接 CC Switch，供聊天和编程 Agent 使用。只读模型配置，不修改 Codex 或 CC Switch 文件。</p>
      </div>

      <section className={styles.panel}>
        <div className={styles.inline}>
          <div>
            <h2>本地代理</h2>
            <div className={styles.sub}>127.0.0.1:15721 · Codex Responses 路由</div>
          </div>
          <div className={styles.actions}>
            <span className={`${styles.pill} ${status?.reachable ? styles.ok : styles.off}`}>
              {loading ? '正在检测' : status?.reachable ? '代理已连接' : '未连接'}
            </span>
            <button onClick={() => void refresh()} disabled={loading}>重新检测</button>
          </div>
        </div>
        <div className={styles.info}>
          <span>连接状态</span><strong>{!status?.reachable ? '代理未启动' : verifiedModel && verifiedModel === (modelOverride.trim() || status.codex.model) ? '最近一次真实模型调用成功' : error ? '代理在线，模型调用失败' : '代理已连接，模型未经验证'}</strong>
          <span>当前 Codex 模型</span><strong>{status?.codex.model || '未识别'}</strong>
          <span>Codex 配置</span><strong>{status?.codex.found ? '已读取（只读）' : '未找到'}</strong>
          <span>接管状态</span><strong>{status?.codex.routesThroughCcSwitch ? 'Codex 路由已指向 CC Switch' : '未确认接管'}</strong>
        </div>
        <label className={styles.switchRow}>
          <input type="checkbox" checked={enabled} disabled={disabled} onChange={event => toggle(event.target.checked)} />
          <span>允许 Strip 通过 CC Switch 发送模型请求</span>
        </label>
        <p className={styles.muted}>此开关只保存在 Strip 本地浏览器设置中，不会改变 CC Switch 的路由。切换 CC Switch 的 Codex Provider 将影响使用该路由的其他 Codex 客户端。</p>
      </section>

      <section className={styles.panel}>
        <h2>模型调用测试（手动）</h2>
        <p className={styles.muted}>连接检测不消耗模型 Token。下方“发送测试请求”会调用真实模型，可能产生费用。</p>
        <label className={styles.fieldLabel} htmlFor="cc-switch-model">模型名称（留空自动跟随 CC Switch）</label>
        <input id="cc-switch-model" className={styles.textInput} disabled={disabled} value={modelOverride} onChange={e => {setModelOverride(e.target.value);localStorage.setItem('strip.ccswitch.model.v1',e.target.value);onChange(enabled,e.target.value.trim());}} placeholder={status?.codex.model ? `自动跟随：${status.codex.model}` : '可手动输入模型名称'} />
        <label className={styles.fieldLabel} htmlFor="cc-switch-test-prompt">测试消息</label>
        <textarea id="cc-switch-test-prompt" className={styles.textarea} value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} />
        <button className={styles.primary} disabled={!enabled || !status?.reachable || testing || !prompt.trim() || !(modelOverride.trim() || status?.codex.model)} onClick={() => void test()}>
          {testing ? '正在调用模型…' : '发送测试请求'}
        </button>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        {answer && <div className={styles.answer}><strong>模型回复</strong><pre>{answer}</pre></div>}
      </section>

      <p className={styles.muted}>关闭连接后暂停模型请求；在对话框点击发送会重新开启连接。新任务读取当前模型，已有任务保留模型绑定；模型变更后请新建任务。代理在线不代表上游模型或工具调用已经通过验证。</p>
    </div>
  );
}
