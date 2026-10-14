import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { StripDropdown } from './StripDropdown';
import type { StripDropdownOption } from './StripDropdown';
import './strip-codex-composer.css';

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
  efforts?: StripModelOption[];
  environments?: StripModelOption[];
  permissions?: StripModelOption[];
  placeholder?: string;
  initialText?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  busy?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  sendDisabled?: boolean;
  sendDisabledReason?: string;
  className?: string;
};

const defaultModels: StripModelOption[] = [{ value: 'current', label: '当前模型' }];
const defaultEfforts: StripModelOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const defaultEnvironments: StripModelOption[] = [{ value: 'local', label: '本地' }];
const defaultPermissions: StripModelOption[] = [{ value: 'on-request', label: '按需批准' }];

function Icon({ name, size = 17 }: { name: 'plus'|'arrow-up'|'mic'|'chevron-down'|'x'|'file'|'laptop'|'shield'|'stop'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    'arrow-up': <path d="M12 19V5m-7 7 7-7 7 7" />,
    mic: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4m-4 0h8" /></>,
    'chevron-down': <path d="m6 9 6 6 6-6" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    file: <><path d="M13 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9.5z"/><path d="M13 2.5v7h7" /></>,
    laptop: <><rect x="4" y="3" width="16" height="13" rx="2" /><path d="M2 20h20" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
    stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
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

export function StripCodexComposer({
  onSend,
  onVoice,
  onError,
  models = defaultModels,
  selectedModel,
  onModelChange,
  modelType,
  efforts = defaultEfforts,
  environments = defaultEnvironments,
  permissions = defaultPermissions,
  placeholder = '向 Strip 描述你的任务…',
  initialText = '',
  value,
  onValueChange,
  busy: streaming = false,
  onStop,
  disabled = false,
  sendDisabled = false,
  sendDisabledReason,
  className = '',
}: StripCodexComposerProps) {
  const [innerText, setInnerText] = useState(initialText);
  const [files, setFiles] = useState<File[]>([]);
  const [innerModel, setInnerModel] = useState(models[0]?.value ?? 'current');
  const model = selectedModel ?? (models.some(option => option.value === innerModel) ? innerModel : models[0]?.value ?? '');
  function setModel(next: string) { setInnerModel(next); onModelChange?.(next); }
  const [effort, setEffort] = useState(efforts.find(o=>o.value === 'medium')?.value ?? efforts[0]?.value ?? 'medium');
  const [environment, setEnvironment] = useState(environments[0]?.value ?? 'local');
  const [permission, setPermission] = useState(permissions[0]?.value ?? 'on-request');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  const text = value ?? innerText;
  function updateText(next: string) {
    if (value === undefined) setInnerText(next);
    onValueChange?.(next);
  }

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    const nextHeight = Math.min(area.scrollHeight, 220);
    area.style.height = `${Math.max(nextHeight, 51)}px`;
    area.style.overflowY = area.scrollHeight > 220 ? 'auto' : 'hidden';
  }, [text]);

  const busy = sending || disabled;
  const canSend = !busy && !streaming && !sendDisabled && (text.trim().length > 0 || files.length > 0);

  function addFiles(incoming: FileList | File[] | null) {
    if (!incoming?.length) return;
    setFiles(previous => {
      const unique = new Map(previous.map(file => [`${file.name}:${file.size}:${file.lastModified}`, file]));
      Array.from(incoming).forEach(file => unique.set(`${file.name}:${file.size}:${file.lastModified}`, file));
      return Array.from(unique.values());
    });
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.target.files);
    event.target.value = '';
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (event.clipboardData.files.length) addFiles(event.clipboardData.files);
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    if (event.dataTransfer.files.length) {
      event.preventDefault();
      if (!busy) addFiles(event.dataTransfer.files);
    }
  }

  async function submit() {
    if (!canSend) return;
    setError('');
    setSending(true);
    try {
      await onSend({ text: text.trim(), files: [...files], model, effort, environment, permission });
      if (value === undefined) setInnerText('');
      setFiles([]);
    } catch (err) {
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
    if (event.key === 'Enter' && !event.shiftKey && !composingRef.current && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <section className={`strip-codex-composer ${className}`.trim()} aria-label="消息输入框">
      <form className="strip-codex-composer__panel" onSubmit={handleSubmit} onDrop={handleDrop}
        onDragOver={event=>{ if(event.dataTransfer.types.includes('Files')) event.preventDefault(); }} aria-busy={sending || streaming}>
        <div className="strip-codex-composer__editor">
          <textarea ref={areaRef} aria-label="输入任务内容" className="strip-codex-composer__textarea"
            placeholder={placeholder} rows={2} value={text} onChange={event=>updateText(event.target.value)}
            onKeyDown={handleKeyDown} onPaste={handlePaste} onCompositionStart={()=>{composingRef.current=true;}}
            onCompositionEnd={()=>{composingRef.current=false;}} disabled={disabled} />
        </div>
        {files.length > 0 && <div className="strip-codex-composer__files" aria-label="待发送的附件">
          {files.map((file,index)=><span className="strip-codex-composer__file" key={`${file.name}-${file.size}-${file.lastModified}`}>
            <Icon name="file" size={13}/>
            <span className="strip-codex-composer__file-name" title={file.name}>{file.name}</span>
            <button type="button" className="strip-codex-composer__file-remove" disabled={busy}
              onClick={()=>setFiles(previous=>previous.filter((_,i)=>i!==index))} aria-label={`移除附件 ${file.name}`}><Icon name="x" size={13}/></button>
          </span>)}
        </div>}
        <div className="strip-codex-composer__toolbar">
          <input ref={fileRef} type="file" hidden multiple onChange={handleFiles} disabled={busy} aria-label="添加附件" />
          <button type="button" className="strip-codex-composer__tool" title="添加附件" aria-label="添加附件"
            disabled={busy} onClick={()=>fileRef.current?.click()}><Icon name="plus" size={18}/></button>
          <Choice label="选择模型" value={model} options={models} onChange={setModel} disabled={busy} />
          {modelType && <span className="strip-codex-composer__model-type" aria-label="模型接口类型" title={modelType}>{modelType}</span>}
          <Choice label="推理强度" value={effort} options={efforts} onChange={setEffort} disabled={busy} />
          <span className="strip-codex-composer__spacer" />
          {onVoice && <button type="button" className="strip-codex-composer__tool" title="语音输入" aria-label="语音输入"
            onClick={onVoice} disabled={busy}><Icon name="mic" /></button>}
          {streaming ? (
            <button type="button" className="strip-codex-composer__send" aria-label="停止生成" title="停止生成"
              onClick={onStop}>
              <Icon name="stop" />
            </button>
          ) : (
            <button type="submit" className="strip-codex-composer__send" aria-label={sending ? '发送中' : '发送'}
              title={sendDisabled ? sendDisabledReason || '当前无法发送' : '发送（Enter）'} disabled={!canSend}>
              <Icon name="arrow-up" />
            </button>
          )}
        </div>
      </form>
      <div className="strip-codex-composer__status">
        <span className="strip-codex-composer__status-icon"><Icon name="laptop" size={13}/></span>
        <Choice label="运行环境" value={environment} options={environments} onChange={setEnvironment} disabled={busy} compact />
        <span className="strip-codex-composer__status-icon"><Icon name="shield" size={13}/></span>
        <Choice label="权限模式" value={permission} options={permissions} onChange={setPermission} disabled={busy} compact />
        <span className="strip-codex-composer__hint">Enter 发送 · Shift + Enter 换行</span>
      </div>
      {error && <div className="strip-codex-composer__error" role="alert">{error}</div>}
    </section>
  );
}

export default StripCodexComposer;
