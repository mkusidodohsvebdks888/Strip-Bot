import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import './strip-dropdown.css';

export type StripDropdownOption = {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
};

export type StripDropdownProps = {
  ariaLabel: string;
  value: string;
  options: StripDropdownOption[];
  onChange: (value: string) => void;
  title?: string;
  icon?: ReactNode;
  searchable?: boolean;
  compact?: boolean;
  disabled?: boolean;
  align?: 'start' | 'end';
  placement?: 'top' | 'bottom';
  className?: string;
};

function Chevron() {
  return <svg className="strip-dropdown__chevron" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

function Check() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function Search() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
}

export function StripDropdown({
  ariaLabel, value, options, onChange, title = ariaLabel, icon,
  searchable = false, compact = false, disabled = false, align = 'start',
  placement = 'top', className = '',
}: StripDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const uid = useId();
  const listId = `${uid}-list`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const selected = options.find(option => option.value === value);
  const filtered = useMemo(() => options.filter(option =>
    `${option.label} ${option.value} ${option.description ?? ''}`.toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
  ), [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const index = options.findIndex(option => option.value === value && !option.disabled);
    setActive(index >= 0 ? index : Math.max(0, options.findIndex(option => !option.disabled)));
    const frame = requestAnimationFrame(() => {
      (searchable && options.length > 5 ? searchRef.current : listRef.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]); // The selection is captured when the dropdown opens.

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onFocus = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    if (!popup) return;
    const clampToViewport = () => {
      popup.style.marginLeft = '0px';
      const rect = popup.getBoundingClientRect();
      const padding = 12;
      let shift = 0;
      if (rect.right > window.innerWidth - padding) shift = window.innerWidth - padding - rect.right;
      if (rect.left + shift < padding) shift += padding - (rect.left + shift);
      popup.style.marginLeft = `${shift}px`;
    };
    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [open, query, options.length]);

  useEffect(() => {
    if (open && !searchable) itemRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active, searchable]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(option: StripDropdownOption) {
    if (option.disabled) return;
    onChange(option.value);
    close(true);
  }

  function findEnabled(start: number, direction: number) {
    if (!filtered.length) return -1;
    for (let count = 0; count < filtered.length; count++) {
      const index = (start + direction * (count + 1) + filtered.length * 2) % filtered.length;
      if (!filtered[index].disabled) return index;
    }
    return -1;
  }

  function handleMenuKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(current => findEnabled(current, event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      if (searchable && event.target === searchRef.current) return;
      event.preventDefault();
      const indexes = filtered.map((option, index) => !option.disabled ? index : -1).filter(index => index >= 0);
      setActive(event.key === 'Home' ? indexes[0] ?? -1 : indexes[indexes.length - 1] ?? -1);
    } else if (event.key === 'Enter' || (event.key === ' ' && event.target !== searchRef.current)) {
      event.preventDefault();
      if (active >= 0 && filtered[active]) choose(filtered[active]);
    }
  }

  const classes = [
    'strip-dropdown', compact ? 'strip-dropdown--compact' : '',
    open ? 'strip-dropdown--open' : '', className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} ref={rootRef} data-align={align} data-placement={placement}>
      <button className="strip-dropdown__trigger" type="button" ref={triggerRef} disabled={disabled}
        aria-label={`${ariaLabel}: ${selected?.label ?? value}`}
        aria-haspopup="listbox" aria-controls={open ? listId : undefined}
        aria-expanded={open} onClick={() => setOpen(current => !current)}
        onKeyDown={event => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}>
        {icon && <span className="strip-dropdown__trigger-icon" aria-hidden="true">{icon}</span>}
        <span className="strip-dropdown__value">{selected?.label ?? value}</span>
        <Chevron />
      </button>
      {open && (
        <span className="strip-dropdown__popup" ref={popupRef} onKeyDown={handleMenuKey}>
          <span className="strip-dropdown__header"><span>{title}</span><kbd>ESC</kbd></span>
          {searchable && options.length > 5 && (
            <span className="strip-dropdown__search-wrap"><Search />
              <input className="strip-dropdown__search" ref={searchRef} value={query}
                onChange={event => { setQuery(event.target.value); setActive(0); }}
                aria-label={`${ariaLabel}: search`} aria-controls={listId}
                aria-activedescendant={active >= 0 && filtered[active] ? `${listId}-option-${active}` : undefined}
                placeholder="Search..." autoComplete="off" spellCheck={false} />
            </span>
          )}
          <span className="strip-dropdown__list" ref={listRef} role="listbox" tabIndex={-1}
            aria-label={title} id={listId}
            aria-activedescendant={active >= 0 && filtered[active] ? `${listId}-option-${active}` : undefined}>
            {filtered.map((option, index) => (
              <span key={option.value} id={`${listId}-option-${index}`} ref={node => { itemRefs.current[index] = node; }}
                role="option" aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                className={['strip-dropdown__option', index === active ? 'strip-dropdown__option--active' : '',
                  option.disabled ? 'strip-dropdown__option--disabled' : ''].filter(Boolean).join(' ')}
                onMouseEnter={() => { if (!option.disabled) setActive(index); }}
                onClick={() => choose(option)}>
                <span className="strip-dropdown__option-text">
                  <span className="strip-dropdown__option-label">{option.label}
                    {option.badge && <span className="strip-dropdown__badge">{option.badge}</span>}
                  </span>
                  {option.description && <span className="strip-dropdown__description">{option.description}</span>}
                </span>
                {option.value === value && <span className="strip-dropdown__check"><Check /></span>}
              </span>
            ))}
            {filtered.length === 0 && <span className="strip-dropdown__empty">No matching options</span>}
          </span>
        </span>
      )}
    </span>
  );
}

export default StripDropdown;
