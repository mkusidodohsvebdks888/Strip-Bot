/**
 * Strip Button Studio: Codex + Claude inspired, independently written React UI.
 * React 18/19 compatible. No Tailwind/shadcn required.
 * Import '../assets/buttons.css' once in your app.
 * Copy icons into public/strip-buttons/icons; default iconBasePath uses that path.
 * Wrap in <AgentTheme ui="codex" mode="light"> ... </AgentTheme>.
 */
import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';

export type AgentUIStyle = 'codex' | 'claude' | 'fusion';
export type AgentMode = 'light' | 'dark';
export type AgentButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'soft' | 'danger' | 'chip';
export type AgentButtonSize = 'sm' | 'md' | 'lg';
export type AgentIconName =
  | 'arrow-left' | 'arrow-right' | 'arrow-up' | 'bot' | 'check' | 'chevron-down' | 'chevron-right'
  | 'circle-help' | 'copy' | 'download' | 'file' | 'folder' | 'heart' | 'info' | 'loader-circle'
  | 'maximize-2' | 'menu' | 'message-circle' | 'minimize-2' | 'more-horizontal' | 'more-vertical'
  | 'panel-left' | 'pause' | 'play' | 'plus' | 'refresh-cw' | 'rotate-ccw' | 'search' | 'send'
  | 'settings' | 'sliders-horizontal' | 'square-pen' | 'terminal' | 'trash-2' | 'upload' | 'x';

const DEFAULT_ICONS = '/strip-buttons/icons';

export type AgentThemeProps = HTMLAttributes<HTMLDivElement> & {
  ui?: AgentUIStyle;
  mode?: AgentMode;
  children: ReactNode;
};
export function AgentTheme({ ui = 'codex', mode = 'light', className = '', children, ...rest }: AgentThemeProps) {
  return <div {...rest} className={`scb ${className}`.trim()} data-ui={ui} data-mode={mode}>{children}</div>;
}

export type AgentIconProps = {
  name: AgentIconName;
  iconBasePath?: string;
  size?: number;
  className?: string;
};
export function AgentIcon({ name, iconBasePath = DEFAULT_ICONS, size, className = '' }: AgentIconProps) {
  const style = {
    '--scb-icon': `url("${iconBasePath.replace(/\/$/, '')}/${name}.svg")`,
    ...(size ? { '--scb-icon-size': `${size}px` } : {}),
  } as CSSProperties;
  return <span aria-hidden="true" className={`scb-icon ${className}`.trim()} style={style} />;
}

export type AgentButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & {
  variant?: AgentButtonVariant;
  size?: AgentButtonSize;
  icon?: AgentIconName;
  iconRight?: AgentIconName;
  iconBasePath?: string;
  round?: boolean;
  iconOnly?: boolean;
  loading?: boolean;
  pressed?: boolean;
  children?: ReactNode;
};
export function AgentButton({
  variant = 'secondary', size = 'md', icon, iconRight, iconBasePath,
  round = false, iconOnly = false, loading = false, pressed, disabled = false,
  className = '', children, type = 'button', ...rest
}: AgentButtonProps) {
  const classNames = [
    'scb-btn', `scb-btn--${variant}`, size === 'md' ? '' : `scb-btn--${size}`,
    round ? 'scb-btn--round' : '', iconOnly ? 'scb-btn--icon' : '', className,
  ].filter(Boolean).join(' ');
  return <button {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
    aria-pressed={pressed === undefined ? undefined : pressed} className={classNames}>
    {loading ? <span className="scb-spinner" aria-hidden="true" /> : icon ? <AgentIcon name={icon} iconBasePath={iconBasePath} /> : null}
    {children && !iconOnly ? <span>{children}</span> : null}
    {iconRight && !iconOnly ? <AgentIcon name={iconRight} iconBasePath={iconBasePath} /> : null}
  </button>;
}

/** Accessibility: pass aria-label for icon-only controls. */
export type AgentIconButtonProps = Omit<AgentButtonProps, 'children' | 'iconOnly' | 'icon'> & {
  icon: AgentIconName;
  'aria-label': string;
};
export function AgentIconButton(props: AgentIconButtonProps) {
  return <AgentButton {...props} iconOnly />;
}

export type AgentSegmentOption<T extends string = string> = {value: T; label: string; disabled?: boolean};
export type AgentSegmentProps<T extends string = string> = {
  value: T;
  options: AgentSegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
};
export function AgentSegmented<T extends string>({ value, options, onChange, label }: AgentSegmentProps<T>) {
  return <div className="scb-segment" role="group" aria-label={label}>
    {options.map((opt) => <button key={opt.value} type="button" className="scb-btn"
      aria-pressed={opt.value === value} disabled={opt.disabled} onClick={() => onChange(opt.value)}>
      {opt.label}
    </button>)}
  </div>;
}

export type AgentDropdownItem<T extends string = string> = {
  value: T;
  label: string;
  icon?: AgentIconName;
  disabled?: boolean;
};
export type AgentDropdownProps<T extends string = string> = {
  label?: ReactNode;
  items: AgentDropdownItem<T>[];
  value?: T;
  onChange: (value: T) => void;
  variant?: AgentButtonVariant;
  iconBasePath?: string;
  ariaLabel?: string;
};
export function AgentDropdown<T extends string>({
  label, items, value, onChange, variant = 'secondary', iconBasePath, ariaLabel = '选择一个选项',
}: AgentDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLSpanElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onEscape);
    return () => {document.removeEventListener('mousedown', onPointer);document.removeEventListener('keydown', onEscape);};
  }, [open]);
  useEffect(() => {if (open) firstItem.current?.focus();}, [open]);
  const selectedLabel = items.find((entry) => entry.value === value)?.label;
  return <span className="menu-anchor" ref={container}>
    <AgentButton variant={variant} iconRight="chevron-down" iconBasePath={iconBasePath}
      aria-label={ariaLabel} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
      {label ?? selectedLabel ?? '选择'}
    </AgentButton>
    {open && <div className="scb-menu" role="menu" style={{top: 'calc(100% + 6px)',left: 0}}>
      {items.map((entry, i) => <button key={entry.value} type="button" ref={i === 0 ? firstItem : undefined}
        role="menuitemradio" aria-checked={value === entry.value} className="scb-menu-item"
        disabled={entry.disabled} onClick={() => {onChange(entry.value);setOpen(false);}}>
        {entry.icon ? <AgentIcon name={entry.icon} iconBasePath={iconBasePath} /> : value === entry.value ? <AgentIcon name="check" iconBasePath={iconBasePath}/> : null}
        {entry.label}
      </button>)}
    </div>}
  </span>;
}

export type AgentApprovalProps = {
  title?: string;
  description?: string;
  onReject: () => void;
  onAllowOnce: () => void;
  onAllowAll: () => void;
};
export function AgentApprovalActions({
  title = '请求执行命令', description = '此操作需要你的批准', onReject, onAllowOnce, onAllowAll,
}: AgentApprovalProps) {
  return <div className="scb-approval">
    <div className="scb-approval-copy"><b>{title}</b><small>{description}</small></div>
    <AgentButton variant="outline" onClick={onReject}>拒绝</AgentButton>
    <AgentButton variant="secondary" onClick={onAllowOnce}>允许一次</AgentButton>
    <AgentButton variant="primary" icon="check" onClick={onAllowAll}>允许全部</AgentButton>
  </div>;
}

export type AgentComposerProps = {
  value: string;
  onChange: (next: string) => void;
  onSend: (value: string) => void;
  onAttach?: () => void;
  placeholder?: string;
  model: string;
  models: string[];
  onModelChange: (model: string) => void;
  disabled?: boolean;
  iconBasePath?: string;
};
export function AgentComposer({
  value, onChange, onSend, onAttach, placeholder = '描述你想完成的任务...',
  model, models, onModelChange, disabled = false, iconBasePath,
}: AgentComposerProps) {
  const submit = () => {if (!disabled && value.trim()) onSend(value.trim());};
  return <div className="scb-composer">
    <textarea className="scb-compose-text" value={value} onChange={(event) => onChange(event.target.value)}
      aria-label="输入消息" placeholder={placeholder} disabled={disabled}
      onKeyDown={(event) => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault();submit();}}}
    />
    <div className="scb-compose-actions">
      <AgentIconButton variant="ghost" icon="plus" aria-label="添加附件" title="添加附件"
        iconBasePath={iconBasePath} disabled={!onAttach} onClick={onAttach} />
      <span className="scb-compose-spacer" />
      <AgentDropdown label={model} value={model} items={models.map(value => ({value,label:value}))}
        onChange={onModelChange} variant="ghost" iconBasePath={iconBasePath} ariaLabel="选择模型" />
      <AgentIconButton variant="primary" icon="arrow-up" aria-label="发送消息" title="发送消息"
        iconBasePath={iconBasePath} round disabled={disabled || !value.trim()} onClick={submit} />
    </div>
  </div>;
}
