import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { StripDropdown } from './StripDropdown';
import type { StripDropdownOption } from './StripDropdown';
import './strip-codex-composer.css';
import {ControlIcon} from './ControlIcon';
import {estimateTokens,formatBytes,MAX_FILE_BYTES,MAX_FILE_COUNT,MAX_PROMPT_CHARS,validateFiles} from '../lib/workflow-input.mjs';
import {expandSlash,matchSlash} from '../lib/prompt-enhancer.mjs';

export type StripModelOption = StripDropdownOption;
export type StripComposerMessage = {
  text: string;
  files: File[];
  model: string;
  effort: string;
  environment: string;
  permission: string;
};

export type StripCodexComposerProps = {
  onSend: (message: StripComposerMessage) => Promise<void> | void;
  onVoice?: () => void;
  onError?: (error: unknown) => void;
  models?: StripModelOption[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  modelType?: string;
  modelReadOnly?: boolean;
  modelControl?: ReactNode;
  permissionControl?: ReactNode;
  /** Opens the real model/effort panel from the compact composer footer. */
  onOpenModelTools?: () => void;
  modelEffortLabel?: string;
  efforts?: StripModelOption[];
  environments?: StripModelOption[];
  permissions?: StripModelOption[];
  placeholder?: string;
  initialText?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  /** Local welcome animation: true only for user edits, false on blur. */
  onInputActivity?: (active:boolean) => void;
  busy?: boolean;
  queueWhileBusy?: boolean;
  onStop?: () => Promise<void> | void;
  /** 生成中按 Esc 是否停止（焦点在输入框内）。 */
  stopOnEscape?: boolean;
  disabled?: boolean;
  sendDisabled?: boolean;
  sendDisabledReason?: string;
  className?: string;
  /** With a left rail, keep only the editor and send/stop controls here. */
  toolsInSidebar?: boolean;
};

export type StripCodexComposerHandle = { openFilePicker: () => void; focus: () => void };

const defaultModels: StripModelOption[] = [{ value: 'current', label: '当前模型' }];
const defaultEfforts: StripModelOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const defaultEnvironments: StripModelOption[] = [{ value: 'local', label: '本地' }];
const defaultPermissions: StripModelOption[] = [{ value: 'on-request', label: '按需批准' }];

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && (error as {name?: unknown}).name === 'AbortError');
}

function Icon({ name, size = 17 }: { name: 'plus'|'arrow-up'|'mic'|'chevron-down'|'x'|'file'|'laptop'|'shield'|'stop'; size?: number }) {
  const icon = {
    'arrow-up': 'up',
    'chevron-down': 'down',
    x: 'close',
    plus: 'plus',
    mic: 'mic',
    file: 'file',
    laptop: 'laptop',
    shield: 'shield',
    stop: 'stop',
  } as const;
  return <ControlIcon name={icon[name]} size={size} />;
}

function Choice({ label, value, options, onChange, disabled, compact = false }: {
  label: string;
  value: string;
  options: StripModelOption[];
  onChange: (value: string) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return <StripDropdown ariaLabel={label} title={label} value={value} options={options}
    onChange={onChange} disabled={disabled} compact={compact} searchable={options.length > 5}
    placement="top" align="start" />;
}

export const StripCodexComposer = forwardRef<StripCodexComposerHandle, StripCodexComposerProps>(function StripCodexComposer({
  onSend,
  onVoice,
  onError,
  models = defaultModels,
  selectedModel,
  onModelChange,
  modelType,
  modelReadOnly = false,
  modelControl,
  permissionControl,
  onOpenModelTools,
  modelEffortLabel,
  efforts = defaultEfforts,
  environments = defaultEnvironments,
  permissions = defaultPermissions,
  placeholder = '向 Strip 描述你的任务…',
  initialText = '',
  value,
  onValueChange,
  onInputActivity,
  busy: streaming = false,
  queueWhileBusy = false,
  onStop,
  stopOnEscape = true,
  disabled = false,
  sendDisabled = false,
  sendDisabledReason,
  className = '',
  toolsInSidebar = false,
}: StripCodexComposerProps, ref) {
  const [innerText, setInnerText] = useState(initialText);
  const [files, setFiles] = useState<File[]>([]);
  const [innerModel, setInnerModel] = useState(models[0]?.value ?? 'current');
  const model = selectedModel ?? (models.some(option => option.value === innerModel) ? innerModel : models[0]?.value ?? '');
  function setModel(next: string) { setInnerModel(next); onModelChange?.(next); }
  const [effort, setEffort] = useState(efforts.find(o=>o.value === 'medium')?.value ?? efforts[0]?.value ?? 'medium');
  const [environment, setEnvironment] = useState(environments[0]?.value ?? 'local');
  const [permission, setPermission] = useState(permissions[0]?.value ?? 'on-request');
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const stoppingRef = useRef(false);
  const announceTimer = useRef<number | undefined>(undefined);
  useImperativeHandle(ref, () => ({
    openFilePicker: () => { if(!disabled && (!streaming || queueWhileBusy) && !sending) fileRef.current?.click(); },
    focus: () => areaRef.current?.focus(),
  }), [disabled, streaming, sending, queueWhileBusy]);

  const disabledHintId=useId();
  const text = value ?? innerText;
  function updateText(next: string) {
    if (value === undefined) setInnerText(next);
    onValueChange?.(next);
  }
  const slashMatches=matchSlash(text);

  const measure = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    const max = 220;
    const min = 28;
    const next = Math.min(Math.max(area.scrollHeight, min), max);
    area.style.height = `${next}px`;
    area.style.overflowY = area.scrollHeight > max ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => { measure(); }, [measure, text]);

  // busy 变回 false 后复位“停止中”，把焦点还给输入框并播报停止完成。
  useEffect(() => {
    if (streaming || !stopping || stopPending) return;
    stoppingRef.current = false;
    setStopping(false);
    setAnnounce('已停止生成');
    areaRef.current?.focus();
    if (announceTimer.current !== undefined) window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => {
      setAnnounce('');
      announceTimer.current = undefined;
    }, 1500);
  }, [streaming, stopping, stopPending]);

  useEffect(() => () => {
    if (announceTimer.current !== undefined) window.clearTimeout(announceTimer.current);
  }, []);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    let lastWidth = area.clientWidth;
    const onResize = () => {
      if (area.clientWidth !== lastWidth) {
        lastWidth = area.clientWidth;
        measure();
      }
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    observer?.observe(area);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const busy = sending || disabled;
  const fileActionsDisabled = busy || (streaming && !queueWhileBusy);
  const canSend = !busy && (!streaming || queueWhileBusy) && !stopping && !sendDisabled && text.length <= MAX_PROMPT_CHARS && (text.trim().length > 0 || files.length > 0);
  const showStop = streaming && Boolean(onStop) && !(queueWhileBusy && (text.trim() || files.length));
  const stopVisible = showStop || stopping;
  const actionState = stopping ? 'stopping' : showStop ? 'stop' : 'send';

  function addFiles(incoming: FileList | File[] | null): boolean {
    if (!incoming?.length) return false;
    const unique = new Map(files.map(file => [`${file.name}:${file.size}:${file.lastModified}`,file]));
    Array.from(incoming).forEach(file=>unique.set(`${file.name}:${file.size}:${file.lastModified}`,file));
    try {
      const next = Array.from(unique.values());
      validateFiles(next);
      setFiles(next);
      setError('');
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : '附件超出限制');
      return false;
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    if(!fileActionsDisabled)addFiles(event.target.files);
    event.target.value = '';
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (fileActionsDisabled) return;
    const data = event.clipboardData;
    if (data.files.length) { addFiles(data.files); return; }
    const pasted = data.getData('text');
    if (pasted.length <= 4000 || new Blob([pasted]).size > MAX_FILE_BYTES) return;
    if (files.length >= MAX_FILE_COUNT) {
      setError('附件已达 ' + MAX_FILE_COUNT + ' 个上限，已按普通文本粘贴。');
      return;
    }
    const file = new File([pasted], 'pasted-' + Date.now() + '.txt', { type: 'text/plain' });
    if (addFiles([file])) event.preventDefault();
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    if (event.dataTransfer.files.length) {
      event.preventDefault();
      if (!fileActionsDisabled) addFiles(event.dataTransfer.files);
    }
  }

  async function stop() {
    if (!showStop || stoppingRef.current) return;
    // Ref lock closes the double-click race before React commits disabled=true.
    stoppingRef.current = true;
    setStopping(true);
    setStopPending(true);
    setAnnounce('');
    setError('');
    try {
      await onStop?.();
    } catch (err) {
      stoppingRef.current = false;
      setStopping(false);
      setError('停止失败，请检查连接后重试。');
      onError?.(err);
    } finally {
      setStopPending(false);
    }
  }

  async function submit() {
    if (!canSend) return;
    setError('');
    setAnnounce('');
    setSending(true);
    try {
      await onSend({ text: text.trim(), files: [...files], model, effort, environment, permission });
      if (value === undefined) setInnerText('');
      setFiles([]);
    } catch (err) {
      if (isAbortError(err)) return;
      setError('发送失败，请检查连接后重试。');
      onError?.(err);
    } finally {
      setSending(false);
      areaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape' && showStop && stopOnEscape) {
      event.preventDefault();
      void stop();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && !fileActionsDisabled && !composingRef.current && !event.nativeEvent.isComposing) {
      const expanded=expandSlash(text);
      if(expanded){event.preventDefault();updateText(expanded);return;}
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || !event.shiftKey) && !composingRef.current && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <section className={`strip-codex-composer ${className}`.trim()} aria-label="消息输入框" data-opencode-composer="ready">
      {sendDisabled && sendDisabledReason && <p id={disabledHintId} className="strip-composer-disabled-hint">{sendDisabledReason}</p>}
      <form className="strip-codex-composer__panel" onSubmit={handleSubmit} onDrop={handleDrop}
        onDragOver={event=>{ if(event.dataTransfer.types.includes('Files')) event.preventDefault(); }} aria-busy={sending || streaming}>
        <div className="strip-codex-composer__editor">
          {slashMatches.length > 0 && (
            <div className="strip-codex-composer__slash-hints" role="listbox" aria-label="斜杠命令">
              {slashMatches.map(command => (
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  key={command.cmd}
                  title={command.label}
                  disabled={fileActionsDisabled}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    if (fileActionsDisabled) return;
                    updateText(command.template);
                    areaRef.current?.focus();
                  }}
                >
                  <strong>{command.cmd}</strong><span>{command.label}</span>
                </button>
              ))}
            </div>
          )}
          <textarea ref={areaRef} aria-label="输入任务内容" className="strip-codex-composer__textarea"
            placeholder={streaming ? queueWhileBusy ? '继续输入新任务，Enter 加入队列 · Esc 停止' : '正在生成… 可继续输入，Esc 停止' : placeholder} rows={1} value={text} onChange={event=>{updateText(event.target.value);onInputActivity?.(true);}} onBlur={()=>onInputActivity?.(false)}
            maxLength={MAX_PROMPT_CHARS} onKeyDown={handleKeyDown} onPaste={handlePaste} onCompositionStart={()=>{composingRef.current=true;}}
            onCompositionEnd={()=>{composingRef.current=false;}} disabled={disabled} />
        </div>
        {files.length > 0 && <div className="strip-codex-composer__files" aria-label="待发送的附件">
          {files.map((file,index)=><span className="strip-codex-composer__file" key={`${file.name}-${file.size}-${file.lastModified}`}>
            <Icon name="file" size={13}/>
            <span className="strip-codex-composer__file-name" title={`${file.name} · ${formatBytes(file.size)}`}>{file.name} <small>{formatBytes(file.size)}</small></span>
            <button type="button" className="strip-codex-composer__file-remove" disabled={fileActionsDisabled}
              onClick={()=>setFiles(previous=>previous.filter((_,i)=>i!==index))} aria-label={`移除附件 ${file.name}`}><Icon name="x" size={13}/></button>
          </span>)}
        </div>}
        <div className="strip-codex-composer__toolbar">
          <div className="strip-codex-composer__toolbar-start">
            <input ref={fileRef} type="file" hidden multiple onChange={handleFiles} disabled={fileActionsDisabled} aria-label="添加附件" />
            <button type="button" className="strip-codex-composer__tool strip-codex-composer__attach" title="添加附件" aria-label="添加附件"
              disabled={fileActionsDisabled} onClick={()=>fileRef.current?.click()}><Icon name="plus" size={18}/></button>
            {permissionControl && <div className="strip-codex-composer__permission">{permissionControl}</div>}
          </div>
          <div className="strip-codex-composer__toolbar-end">
            {onOpenModelTools ? <button type="button" className="strip-codex-composer__model-shortcut"
              title={[models.find(option=>option.value===model)?.label || model || '等待模型', modelEffortLabel].filter(Boolean).join(' · ')}
              aria-label="打开模型和推理强度设置" aria-controls="strip-tool-panel" onClick={onOpenModelTools}>
              <ControlIcon name="bolt" size={13}/><span className="strip-codex-composer__model-name">{models.find(option=>option.value===model)?.label || model || '等待模型'}</span>
              {modelEffortLabel && <span className="strip-codex-composer__model-effort">{modelEffortLabel}</span>}
              <ControlIcon name="down" size={12}/>
            </button> : (modelControl ?? (!toolsInSidebar && (modelReadOnly ? <span className="strip-codex-composer__model-type" aria-label="当前模型">{models.find(option=>option.value===model)?.label || model || '等待模型'}</span> : <Choice label="选择模型" value={model} options={models} onChange={setModel} disabled={busy} />)))}
            {!toolsInSidebar && !onOpenModelTools && modelType && <span className="strip-codex-composer__model-type" aria-label="模型接口类型" title={modelType}>{modelType}</span>}
            {!toolsInSidebar && !onOpenModelTools && !modelReadOnly && <Choice label="推理强度" value={effort} options={efforts} onChange={setEffort} disabled={busy} />}
            {onVoice && <button type="button" className="strip-codex-composer__tool" title="语音输入" aria-label="语音输入"
              onClick={onVoice} disabled={busy}><Icon name="mic" /></button>}
            <div className="strip-codex-composer__action-slot" data-state={actionState}>
              <button type="submit" className="strip-codex-composer__send" aria-label={sending ? '发送中' : '发送'}
                aria-describedby={sendDisabled && sendDisabledReason?disabledHintId:undefined} title={sendDisabled ? sendDisabledReason || '当前无法发送' : '发送（Enter）'}
                disabled={!canSend} tabIndex={stopVisible ? -1 : 0} aria-hidden={stopVisible}>
                <Icon name="arrow-up" size={18}/>
              </button>
              <button type="button" className="strip-codex-composer__stop"
                onClick={() => void stop()} disabled={!showStop || stopping}
                tabIndex={stopVisible ? 0 : -1} aria-hidden={!stopVisible}
                aria-label={stopping ? '正在停止' : '停止生成'} aria-busy={stopping}
                title={stopping ? '正在停止…' : '停止生成 (Esc)'}>
                <span className="strip-codex-composer__stop-ring" aria-hidden="true" />
                <span className="strip-codex-composer__stop-icon" aria-hidden="true">
                  {stopping ? <span className="strip-codex-composer__stop-spinner" /> : <span className="strip-codex-composer__stop-square" />}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>
      <span className="strip-codex-composer__sr-only" role="status" aria-live="polite">{announce}</span>
      <div className="strip-workflow-input-metrics" role="status"><span>{text.length.toLocaleString()} / {MAX_PROMPT_CHARS.toLocaleString()} 字符</span><span>约 {estimateTokens(text).toLocaleString()} tokens · 仅估算</span>{files.length>0 && <span>文件 {files.length}/{MAX_FILE_COUNT} · 单个≤{Math.round(MAX_FILE_BYTES/1024)} KB</span>}<span className="strip-workflow-input-metrics-note">Enter 发送 · Shift+Enter 换行</span></div>
      {!toolsInSidebar && <div className="strip-codex-composer__status">
        <span className="strip-codex-composer__status-icon"><Icon name="laptop" size={13}/></span>
        <Choice label="运行环境" value={environment} options={environments} onChange={setEnvironment} disabled={busy} compact />
        <span className="strip-codex-composer__status-icon"><Icon name="shield" size={13}/></span>
        {!permissionControl && <Choice label="权限模式" value={permission} options={permissions} onChange={setPermission} disabled={busy} compact />}
      </div>}
      {error && <div className="strip-codex-composer__error" role="alert">{error}</div>}
    </section>
  );
});

export default StripCodexComposer;
