import {useState} from 'react';
import type {KeyboardEvent} from 'react';
import {Icon} from '../../Icons';
import './option-box.css';

export type OptionItem = {
  id: string;
  label: string;
  description?: string;
  /** 'primary' 高亮为主题强调色，'danger' 为删除/拒绝类 */
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
};

export type OptionBoxProps = {
  title: string;
  description?: string;
  options: OptionItem[];
  /** 单选（默认）或多选 */
  multiple?: boolean;
  /** 多选时的确认按钮文案 */
  confirmLabel?: string;
  cancelLabel?: string;
  onSelect: (ids: string[]) => void;
  onCancel?: () => void;
  /** 显示在卡片右上角的小标签，如 "需要确认" */
  badge?: string;
};

/**
 * 主题跟随的选项框：所有颜色都来自 claude-theme.css 的变量（--card-bg / --accent / --border-* …），
 * 在 light / white / dark 外观下自动切换。用于权限确认、模型追问、路径选择等。
 */
export function OptionBox({title, description, options, multiple = false, confirmLabel = '确定', cancelLabel = '取消', onSelect, onCancel, badge}: OptionBoxProps) {
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) => {
    if (!multiple) { onSelect([id]); return; }
    setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.strip-option:not(:disabled)'));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
      next?.focus();
    }
    const n = Number(e.key);
    if (n >= 1 && n <= items.length && !e.metaKey && !e.ctrlKey) { e.preventDefault(); items[n - 1].click(); }
  };

  return (
    <section className="strip-option-box" role="group" aria-label={title}>
      <header className="strip-option-box__head">
        <div>
          <h3 className="strip-option-box__title">{title}</h3>
          {description ? <p className="strip-option-box__desc">{description}</p> : null}
        </div>
        {badge ? <span className="strip-option-box__badge">{badge}</span> : null}
      </header>

      <div className="strip-option-box__list" role={multiple ? 'group' : 'radiogroup'} onKeyDown={onKey}>
        {options.map((o, i) => {
          const active = picked.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              className={`strip-option strip-option--${o.tone ?? 'default'}${active ? ' is-active' : ''}`}
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={multiple ? active : undefined}
              disabled={o.disabled}
              onClick={() => toggle(o.id)}
            >
              <span className="strip-option__key" aria-hidden="true">{i + 1}</span>
              <span className="strip-option__text">
                <span className="strip-option__label">{o.label}</span>
                {o.description ? <span className="strip-option__desc">{o.description}</span> : null}
              </span>
              <span className="strip-option__mark" aria-hidden="true">
                <Icon name={multiple ? (active ? 'check' : 'plus') : 'arrow-right'} />
              </span>
            </button>
          );
        })}
      </div>

      {(multiple || onCancel) ? (
        <footer className="strip-option-box__foot">
          {onCancel ? <button type="button" className="strip-option-box__btn" onClick={onCancel}>{cancelLabel}</button> : null}
          {multiple ? (
            <button type="button" className="strip-option-box__btn strip-option-box__btn--primary" disabled={!picked.length} onClick={() => onSelect(picked)}>
              {confirmLabel}{picked.length ? `（${picked.length}）` : ''}
            </button>
          ) : null}
        </footer>
      ) : null}
      <p className="strip-option-box__hint">按数字键快速选择，↑↓ 切换</p>
    </section>
  );
}
